import { afterEach, describe, expect, it, vi } from "vitest";
import { applySale } from "../src/data/sale.js";
import { applyStoreOperation } from "../src/data/operations.js";

function sampleStore() {
  return {
    products: [{ id: "test_product", stock: 10 }],
    transactions: [], shifts: [], settings: { companyName: "Test only" },
    users: [], revision: 0,
  };
}

function sale() {
  return { id: "test_sale", items: [{ productId: "test_product", qty: 1 }], total: 1 };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function setupStore({ saleFails = false, mutationFails = false,
  pendingSale = false, pendingMutation = false } = {}) {
  let remote = sampleStore();
  let snapshotCallback;
  const saleStarted = deferred();
  const saleGate = deferred();
  const mutationStarted = deferred();
  const mutationGate = deferred();
  const saveSale = vi.fn(async (record) => {
    saleStarted.resolve();
    if (pendingSale) await saleGate.promise;
    if (saleFails) throw new Error("network unavailable");
    const changes = applySale(remote, record);
    if (changes) remote = { ...remote, ...changes, revision: remote.revision + 1 };
    return structuredClone(remote);
  });
  const saveMutation = vi.fn(async (operation) => {
    mutationStarted.resolve();
    if (pendingMutation) await mutationGate.promise;
    if (mutationFails) throw new Error("SYNC_CONFLICT");
    const changes = applyStoreOperation(remote, operation);
    if (changes) remote = { ...remote, ...changes, revision: remote.revision + 1 };
    return structuredClone(remote);
  });
  vi.doMock("../src/data/db.js", () => ({
    getInitialDataSync: () => sampleStore(),
    loadData: async () => sampleStore(),
    clearAllData: () => {},
    saveMutation,
    saveSale,
    saveRestock: vi.fn(),
    subscribeToChanges: (callback) => { snapshotCallback = callback; return () => {}; },
    unsubscribeAll: () => {},
  }));
  return {
    saveSale, saveMutation,
    saleStarted: saleStarted.promise,
    mutationStarted: mutationStarted.promise,
    resolveSale: saleGate.resolve,
    resolveMutation: mutationGate.resolve,
    deliverSnapshot: (data) => {
      remote = structuredClone(data);
      snapshotCallback(structuredClone(data));
    },
  };
}

afterEach(() => {
  vi.doUnmock("../src/data/db.js");
  vi.resetModules();
});

describe("confirmed writes and remote snapshots", () => {
  it("does not show a sale until Firestore confirms it", async () => {
    const db = setupStore({ pendingSale: true });
    const store = await import("../src/data/store.js");
    await store.initStore();
    const saving = store.addTransaction(sale());
    await db.saleStarted;
    expect(store.getTransactions()).toHaveLength(0);
    expect(store.getProducts()[0].stock).toBe(10);
    db.resolveSale();
    await saving;
    expect(store.getTransactions()).toHaveLength(1);
    expect(store.getProducts()[0].stock).toBe(9);
  });

  it("keeps a failed sale out of the totals and stock", async () => {
    setupStore({ saleFails: true });
    const store = await import("../src/data/store.js");
    await store.initStore();
    await expect(store.addTransaction(sale())).rejects.toThrow("network unavailable");
    expect(store.getTransactions()).toHaveLength(0);
    expect(store.getProducts()[0].stock).toBe(10);
    expect(store.getSyncStatus()).toEqual({ pending: false, error: "network unavailable" });
  });

  it("does not show a stock edit before confirmation or after a conflict", async () => {
    const db = setupStore({ pendingMutation: true });
    const store = await import("../src/data/store.js");
    await store.initStore();
    const saving = store.updateProductStock("test_product", 7);
    await db.mutationStarted;
    expect(store.getProducts()[0].stock).toBe(10);
    db.deliverSnapshot({ ...sampleStore(), products: [{ id: "test_product", stock: 9 }], revision: 1 });
    db.resolveMutation();
    await expect(saving).rejects.toThrow("SYNC_CONFLICT");
    expect(db.saveMutation).toHaveBeenCalledOnce();
    expect(store.getProducts()[0].stock).toBe(9);
    expect(store.getSyncStatus()).toEqual({ pending: false,
      error: "SYNC_CONFLICT: data changed on another device; reload and try again" });
  });
});
