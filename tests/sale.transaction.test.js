import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { applySale, retryRevisionTransaction } from "../src/data/sale.js";
import { applyRestock } from "../src/data/restock.js";
import { applyStoreOperation } from "../src/data/operations.js";

const PROJECT_ID = "demo-chomdoi-sales";
const STORE_PATH = "stores/chomdoi_main";
const rules = readFileSync(
  fileURLToPath(new URL("../firestore.secure.rules", import.meta.url)), "utf8",
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

function store() {
  return {
    products: [{ id: "product-1", name: "Demo", stock: 10 }],
    transactions: [],
    restockLogs: [],
    shifts: [],
    settings: { companyName: "Test only" },
    revision: 0,
  };
}

function sale(id, qty = 1) {
  return { id, items: [{ productId: "product-1", qty }], total: qty };
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
    await db.doc(STORE_PATH).set(store());
    for (const uid of ["cashier-a", "cashier-b", "admin-a"]) {
      await db.doc(`staff/${uid}`).set({
        uid, legacyId: uid, username: uid, displayName: uid,
        role: uid === "admin-a" ? "admin" : "user", active: true,
      });
    }
  });
});

afterAll(async () => { await env?.cleanup(); });

async function saveSale(db, saleRecord) {
  const ref = db.doc(STORE_PATH);
  return retryRevisionTransaction(() => db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.data();
    const changes = applySale(current, saleRecord);
    if (changes) {
      transaction.update(ref, { ...changes, revision: current.revision + 1 });
    }
  }));
}

async function saveRestock(db, log) {
  const ref = db.doc(STORE_PATH);
  return retryRevisionTransaction(() => db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.data();
    const changes = applyRestock(current, log);
    if (changes) {
      transaction.update(ref, { ...changes, revision: current.revision + 1 });
    }
  }));
}

async function saveOperation(db, operation) {
  const ref = db.doc(STORE_PATH);
  return retryRevisionTransaction(() => db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.data();
    const changes = applyStoreOperation(current, operation);
    if (changes) transaction.update(ref, { ...changes, revision: current.revision + 1 });
  }));
}

describe("sale transaction against secure Firestore rules", () => {
  it("keeps both sales and deducts stock twice when two devices sell together", async () => {
    const a = env.authenticatedContext("cashier-a").firestore();
    const b = env.authenticatedContext("cashier-b").firestore();
    await Promise.all([saveSale(a, sale("sale-a")), saveSale(b, sale("sale-b"))]);
    const finalStore = (await a.doc(STORE_PATH).get()).data();
    expect(finalStore.transactions.map((t) => t.id).sort()).toEqual(["sale-a", "sale-b"]);
    expect(finalStore.products[0].stock).toBe(8);
    expect(finalStore.revision).toBe(2);
  });

  it("does not deduct twice when the same sale id is retried", async () => {
    const db = env.authenticatedContext("cashier-a").firestore();
    await saveSale(db, sale("sale-once"));
    await saveSale(db, sale("sale-once"));
    const finalStore = (await db.doc(STORE_PATH).get()).data();
    expect(finalStore.transactions).toHaveLength(1);
    expect(finalStore.products[0].stock).toBe(9);
    expect(finalStore.revision).toBe(1);
  });

  it("rejects a sale if the latest stock is insufficient", async () => {
    const db = env.authenticatedContext("cashier-a").firestore();
    await saveSale(db, sale("sale-first", 9));
    await expect(saveSale(db, sale("sale-second", 2))).rejects.toThrow("INSUFFICIENT_STOCK");
    const finalStore = (await db.doc(STORE_PATH).get()).data();
    expect(finalStore.transactions).toHaveLength(1);
    expect(finalStore.products[0].stock).toBe(1);
  });

  it("merges a sale and a restock made at the same time", async () => {
    const a = env.authenticatedContext("cashier-a").firestore();
    const b = env.authenticatedContext("cashier-b").firestore();
    const log = { id: "restock-1", productId: "product-1", quantity: 5 };
    await Promise.all([saveSale(a, sale("sale-a", 2)), saveRestock(b, log)]);
    const finalStore = (await a.doc(STORE_PATH).get()).data();
    expect(finalStore.transactions.map((t) => t.id)).toEqual(["sale-a"]);
    expect(finalStore.restockLogs.map((entry) => entry.id)).toEqual(["restock-1"]);
    expect(finalStore.products[0].stock).toBe(13);
    expect(finalStore.revision).toBe(2);
  });

  it("rejects a stale manual stock count after another device sells", async () => {
    const cashier = env.authenticatedContext("cashier-a").firestore();
    const admin = env.authenticatedContext("admin-a").firestore();
    await saveSale(cashier, sale("sale-a"));
    await expect(saveOperation(admin, {
      kind: "setProductStock", productId: "product-1", stock: 7, expectedStock: 10,
    })).rejects.toThrow("SYNC_CONFLICT");
    const finalStore = (await admin.doc(STORE_PATH).get()).data();
    expect(finalStore.products[0].stock).toBe(9);
    expect(finalStore.transactions.map((item) => item.id)).toEqual(["sale-a"]);
  });

  it("merges a product name edit with a simultaneous sale without resetting stock", async () => {
    const cashier = env.authenticatedContext("cashier-a").firestore();
    const admin = env.authenticatedContext("admin-a").firestore();
    await Promise.all([
      saveSale(cashier, sale("sale-a")),
      saveOperation(admin, { kind: "updateProduct", productId: "product-1",
        expected: { id: "product-1", name: "Demo", stock: 10 },
        updates: { name: "Renamed", stock: 10 } }),
    ]);
    const finalStore = (await admin.doc(STORE_PATH).get()).data();
    expect(finalStore.products[0]).toMatchObject({ name: "Renamed", stock: 9 });
    expect(finalStore.transactions.map((item) => item.id)).toEqual(["sale-a"]);
  });

  it("restores a cancelled sale while another device restocks", async () => {
    const cashier = env.authenticatedContext("cashier-a").firestore();
    const admin = env.authenticatedContext("admin-a").firestore();
    const record = sale("sale-a", 2);
    await saveSale(cashier, record);
    await Promise.all([
      saveRestock(cashier, { id: "restock-a", productId: "product-1", quantity: 5 }),
      saveOperation(admin, { kind: "deleteTransaction", transactionId: record.id,
        expected: record }),
    ]);
    const finalStore = (await admin.doc(STORE_PATH).get()).data();
    expect(finalStore.products[0].stock).toBe(15);
    expect(finalStore.transactions).toHaveLength(0);
    expect(finalStore.restockLogs).toHaveLength(1);
  });

  it("rejects a sale attached to a shift closed by another device", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(STORE_PATH).update({
        shifts: [{ id: "shift-a", status: "active", startTime: "2026-09-24T08:00:00Z" }],
      });
    });
    const cashier = env.authenticatedContext("cashier-a").firestore();
    const admin = env.authenticatedContext("admin-a").firestore();
    await saveOperation(admin, { kind: "closeShift", shiftId: "shift-a",
      endTime: "2026-09-24T09:00:00Z", closedBy: null });
    await expect(saveSale(cashier, { ...sale("late-sale"), shiftId: "shift-a" }))
      .rejects.toThrow("SHIFT_NOT_ACTIVE");
    const finalStore = (await admin.doc(STORE_PATH).get()).data();
    expect(finalStore.transactions).toHaveLength(0);
    expect(finalStore.shifts[0].status).toBe("closed");
  });

  it("merges independent settings but rejects two checks for the same date", async () => {
    const admin = env.authenticatedContext("admin-a").firestore();
    const cashier = env.authenticatedContext("cashier-a").firestore();
    await Promise.all([
      saveOperation(admin, { kind: "updateSettings", expected: { companyName: "Test only" },
        updates: { companyName: "Renamed" } }),
      saveOperation(admin, { kind: "updateSettings", expected: { companyName: "Test only" },
        updates: { theme: "warm-stone" } }),
    ]);
    const first = { id: "check-a", date: "2026-09-24", items: [] };
    const second = { id: "check-b", date: "2026-09-24", items: [] };
    await saveOperation(cashier, { kind: "upsertSupplyCheck", check: first, expected: null });
    await expect(saveOperation(cashier, { kind: "upsertSupplyCheck", check: second,
      expected: null })).rejects.toThrow("SYNC_CONFLICT");
    const finalStore = (await admin.doc(STORE_PATH).get()).data();
    expect(finalStore.settings).toMatchObject({ companyName: "Renamed", theme: "warm-stone" });
    expect(finalStore.supplyChecks).toEqual([first]);
  });

  it("returns stock once when deleting a closed shift and its linked sale", async () => {
    const closedShift = { id: "shift-a", status: "closed", startTime: "2026-09-24T08:00:00Z" };
    const linkedSale = { ...sale("sale-a", 2), shiftId: closedShift.id };
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(STORE_PATH).update({
        products: [{ id: "product-1", name: "Demo", stock: 8 }],
        shifts: [closedShift],
        transactions: [linkedSale],
      });
    });
    const admin = env.authenticatedContext("admin-a").firestore();
    const operation = { kind: "deleteShift", shiftId: closedShift.id,
      expected: closedShift, expectedTransactions: [linkedSale] };
    await saveOperation(admin, operation);
    await saveOperation(admin, operation);
    const finalStore = (await admin.doc(STORE_PATH).get()).data();
    expect(finalStore.shifts).toHaveLength(0);
    expect(finalStore.transactions).toHaveLength(0);
    expect(finalStore.products[0].stock).toBe(10);
    expect(finalStore.revision).toBe(1);
  });

  it("keeps both hotel supply restock logs from two devices", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(STORE_PATH).update({
        hotelSupplies: [{ id: "supply-1", name: "Soap", unit: "piece" }],
      });
    });
    const a = env.authenticatedContext("cashier-a").firestore();
    const b = env.authenticatedContext("cashier-b").firestore();
    await Promise.all([
      saveOperation(a, { kind: "addSupplyRestock",
        log: { id: "supply-restock-a", supplyId: "supply-1", qty: 3 } }),
      saveOperation(b, { kind: "addSupplyRestock",
        log: { id: "supply-restock-b", supplyId: "supply-1", qty: 4 } }),
    ]);
    const finalStore = (await a.doc(STORE_PATH).get()).data();
    expect(finalStore.supplyRestocks.map((item) => item.id).sort())
      .toEqual(["supply-restock-a", "supply-restock-b"]);
  });
});
