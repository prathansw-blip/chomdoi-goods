import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, beforeAll, beforeEach, afterAll, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-chomdoi-tests";
const STORE_PATH = "stores/chomdoi_main";
const rules = readFileSync(
  fileURLToPath(new URL("../firestore.rules", import.meta.url)),
  "utf8",
);

function emulatorAddress() {
  const address = process.env.FIRESTORE_EMULATOR_HOST;
  if (!address) throw new Error("FIRESTORE_EMULATOR_HOST is required; run npm run test:emulator:run");
  const [host, portText] = address.split(":");
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("Refusing to run against a non-local Firestore host");
  }
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1) throw new Error("Invalid emulator port");
  return { host, port };
}

function sampleStore() {
  return {
    products: [{ id: "test_product", stock: 10 }],
    transactions: [],
    settings: { companyName: "Test only" },
    users: [{ id: "test_user", role: "user" }],
  };
}

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { ...emulatorAddress(), rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(STORE_PATH).set(sampleStore());
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("deployed rule shape (local emulator only)", () => {
  it("currently allows an unauthenticated read of the main store", async () => {
    const db = env.unauthenticatedContext().firestore();
    const snapshot = await assertSucceeds(db.doc(STORE_PATH).get());
    expect(snapshot.exists).toBe(true);
  });

  it("currently allows an unauthenticated full-document overwrite", async () => {
    const db = env.unauthenticatedContext().firestore();
    const replacement = { ...sampleStore(), products: [], transactions: [] };
    await assertSucceeds(db.doc(STORE_PATH).set(replacement));
    const snapshot = await db.doc(STORE_PATH).get();
    expect(snapshot.data().products).toEqual([]);
  });

  it("denies deletion and access to other paths", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(db.doc(STORE_PATH).delete());
    await assertFails(db.doc("other/test").get());
  });
});

describe("current whole-document synchronization", () => {
  it("reproduces a lost sale when two clients save stale copies", async () => {
    const a = env.authenticatedContext("cashier-a").firestore();
    const b = env.authenticatedContext("cashier-b").firestore();
    const aCopy = (await a.doc(STORE_PATH).get()).data();
    const bCopy = (await b.doc(STORE_PATH).get()).data();

    aCopy.products[0].stock -= 1;
    aCopy.transactions.push({ id: "sale-a" });
    bCopy.products[0].stock -= 1;
    bCopy.transactions.push({ id: "sale-b" });

    await a.doc(STORE_PATH).set(aCopy);
    await b.doc(STORE_PATH).set(bCopy);

    const finalStore = (await a.doc(STORE_PATH).get()).data();
    expect(finalStore.products[0].stock).toBe(9);
    expect(finalStore.transactions.map((sale) => sale.id)).toEqual(["sale-b"]);
  });
});
