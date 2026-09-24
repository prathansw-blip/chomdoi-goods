import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-chomdoi-secure";
const STORE_PATH = "stores/chomdoi_main";
const rules = readFileSync(
  fileURLToPath(new URL("../firestore.secure.rules", import.meta.url)),
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
    products: [{ id: "product-1", stock: 10 }],
    transactions: [],
    restockLogs: [],
    shifts: [],
    settings: { companyName: "Test only" },
    revision: 0,
  };
}

function staff(uid, role = "user", active = true) {
  return {
    uid,
    legacyId: `legacy-${uid}`,
    username: uid,
    displayName: uid,
    role,
    active,
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
    const db = context.firestore();
    await db.doc(STORE_PATH).set(sampleStore());
    await db.doc("staff/admin-1").set(staff("admin-1", "admin"));
    await db.doc("staff/cashier-1").set(staff("cashier-1"));
    await db.doc("staff/inactive-1").set(staff("inactive-1", "user", false));
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("proposed staff-gated rules", () => {
  it("rejects anonymous, unregistered, and inactive users", async () => {
    for (const context of [
      env.unauthenticatedContext(),
      env.authenticatedContext("not-on-staff"),
      env.authenticatedContext("inactive-1"),
    ]) {
      const db = context.firestore();
      await assertFails(db.doc(STORE_PATH).get());
      await assertFails(db.doc(STORE_PATH).set(sampleStore()));
      await assertFails(db.doc("staff/admin-1").get());
    }
  });

  it("lets active staff read the store and their own profile", async () => {
    const db = env.authenticatedContext("cashier-1").firestore();
    expect((await assertSucceeds(db.doc(STORE_PATH).get())).exists).toBe(true);
    expect((await assertSucceeds(db.doc("staff/cashier-1").get())).data().active).toBe(true);
  });

  it("lets a cashier update sales but not settings or staff permissions", async () => {
    const db = env.authenticatedContext("cashier-1").firestore();
    const store = sampleStore();
    store.products[0].stock = 9;
    store.transactions.push({ id: "sale-1" });
    store.revision = 1;
    await assertSucceeds(db.doc(STORE_PATH).set(store));
    await assertFails(db.doc(STORE_PATH).update({ "settings.companyName": "Changed" }));
    await assertFails(db.doc("staff/cashier-1").update({ role: "admin" }));
    await assertFails(db.doc("staff/new-user").set(staff("new-user")));
  });

  it("rejects legacy passwords but lets admins retain LINE settings", async () => {
    const db = env.authenticatedContext("admin-1").firestore();
    await assertFails(db.doc(STORE_PATH).update({ revision: 1, users: [{ password: "test-only" }] }));
    await assertSucceeds(db.doc(STORE_PATH).update({
      revision: 1,
      "settings.line.channelAccessToken": "test-only",
    }));
    const cashier = env.authenticatedContext("cashier-1").firestore();
    await assertFails(cashier.doc(STORE_PATH).update({
      revision: 2,
      "settings.line.channelAccessToken": "changed",
    }));
  });

  it("lets admins manage staff records but not delete the store", async () => {
    const db = env.authenticatedContext("admin-1").firestore();
    await assertSucceeds(db.doc("staff/new-user").set(staff("new-user")));
    await assertSucceeds(db.doc("staff/new-user").update({ active: false }));
    await assertFails(db.doc("staff/new-user").update({ password: "test-only" }));
    await assertFails(db.doc(STORE_PATH).delete());
  });

  it("rejects stale full-document writes instead of silently losing a sale", async () => {
    const a = env.authenticatedContext("cashier-1").firestore();
    const b = env.authenticatedContext("admin-1").firestore();
    const copyA = (await a.doc(STORE_PATH).get()).data();
    const copyB = (await b.doc(STORE_PATH).get()).data();
    copyA.transactions.push({ id: "sale-a" });
    copyB.transactions.push({ id: "sale-b" });
    copyA.revision = 1;
    copyB.revision = 1;
    await assertSucceeds(a.doc(STORE_PATH).set(copyA));
    await assertFails(b.doc(STORE_PATH).set(copyB));
    expect((await b.doc(STORE_PATH).get()).data().transactions.map((t) => t.id)).toEqual(["sale-a"]);
  });
});
