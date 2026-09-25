import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";

const rules = readFileSync(fileURLToPath(new URL("../firestore.maintenance.rules", import.meta.url)), "utf8");
let env;

beforeAll(async () => {
  const address = process.env.FIRESTORE_EMULATOR_HOST;
  if (!address?.startsWith("127.0.0.1:") && !address?.startsWith("localhost:")) {
    throw new Error("Run this test only with the local Firestore Emulator");
  }
  const [host, port] = address.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-chomdoi-maintenance",
    firestore: { host, port: Number(port), rules },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("stores/chomdoi_main").set({ products: [], settings: {}, users: [] });
    await context.firestore().doc("staff/admin").set({ uid: "admin", role: "admin", active: true });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("maintenance rules", () => {
  it("denies store and staff reads and writes even to an approved admin", async () => {
    const anonymous = env.unauthenticatedContext().firestore();
    const admin = env.authenticatedContext("admin").firestore();
    await assertFails(anonymous.doc("stores/chomdoi_main").get());
    await assertFails(admin.doc("stores/chomdoi_main").get());
    await assertFails(admin.doc("staff/admin").get());
    await assertFails(admin.doc("stores/chomdoi_main").update({ revision: 0 }));
  });
});
