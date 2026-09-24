// store.js — Reactive data store
import {
  loadData,
  saveMutation,
  saveSale,
  saveRestock,
  subscribeToChanges,
  unsubscribeAll,
  getInitialDataSync,
  clearAllData,
} from "./db.js";

let state = null;
let listeners = [];
let pendingOps = 0;
let operationQueue = Promise.resolve();
let generation = 0;
let syncError = null;
let deferredSnapshot = null;

// ─── Instant Sync Init (0ms Blocking) ───
export function initStoreSync() {
  if (!state) {
    state = getInitialDataSync();
  }
  return state;
}

export function resetStore() {
  generation += 1;
  unsubscribeAll();
  state = getInitialDataSync();
  pendingOps = 0;
  operationQueue = Promise.resolve();
  syncError = null;
  deferredSnapshot = null;
  clearAllData();
  notifyAll();
}

// ─── Async Firebase Init ───
export async function initStore() {
  unsubscribeAll();
  if (!state) {
    state = getInitialDataSync();
  }

  try {
    const freshData = await loadData();
    if (freshData && pendingOps === 0) {
      state = freshData;
      syncError = null;
      notifyAll();
    }
  } catch (e) {
    syncError = e;
    notifyAll();
    throw e;
  }

  // Listen for Firebase real-time changes
  subscribeToChanges((newData) => {
    // Keep remote updates while a local action is pending, then apply the
    // newest confirmed revision after that action succeeds or fails.
    if (pendingOps > 0) {
      if (!deferredSnapshot || newData.revision >= deferredSnapshot.revision) {
        deferredSnapshot = newData;
      }
      return;
    }
    if ((newData.revision || 0) < (state?.revision || 0)) return;
    state = { ...newData, users: state?.users || [] };
    syncError = null;
    notifyAll();
  }, (error) => {
    syncError = error;
    notifyAll();
  });
  return state;
}

// ─── Getters ───
export function getState() {
  return state;
}
export function getSyncStatus() {
  return { pending: pendingOps > 0, error: syncError?.message || null };
}
export function waitForSync() {
  if (syncError) return Promise.reject(syncError);
  if (pendingOps === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribe(() => {
      if (syncError) {
        unsubscribe();
        reject(syncError);
      } else if (pendingOps === 0) {
        unsubscribe();
        resolve();
      }
    });
  });
}
export function getProducts() {
  return state?.products || [];
}
export function getTransactions() {
  return state?.transactions || [];
}
export function getRestockLogs() {
  return state?.restockLogs || [];
}
export function getShifts() {
  return state?.shifts || [];
}
export function getSettings() {
  return state?.settings || {};
}
export function getUsers() {
  return state?.users || [];
}
export function getActiveShift() {
  return (state?.shifts || []).find((s) => s.status === "active") || null;
}
// Hotel Supplies
export function getHotelSupplies() {
  return state?.hotelSupplies || [];
}
export function getSupplyChecks() {
  return state?.supplyChecks || [];
}
export function getSupplyRestocks() {
  return state?.supplyRestocks || [];
}

// Actions are serialized on one device and published only after Firestore
// confirms them. A failed action never changes the displayed sale or stock.
function runConfirmed(writer) {
  const currentGeneration = generation;
  pendingOps += 1;
  syncError = null;
  notifyAll();
  const task = operationQueue.then(() => {
    if (currentGeneration !== generation) throw new Error("SESSION_CHANGED");
    return writer();
  });
  operationQueue = task.catch(() => {});
  return task.then((result) => {
    if (currentGeneration === generation) {
      state = { ...result, users: state?.users || [] };
      syncError = null;
      notifyAll();
    }
    return result;
  }, (error) => {
    if (currentGeneration === generation) {
      syncError = error;
      notifyAll();
    }
    throw error;
  }).finally(() => {
    if (currentGeneration === generation) {
      pendingOps -= 1;
      if (pendingOps === 0 && deferredSnapshot) {
        if ((deferredSnapshot.revision || 0) > (state?.revision || 0)) {
          state = { ...deferredSnapshot, users: state?.users || [] };
        }
        deferredSnapshot = null;
      }
      notifyAll();
    }
  });
}

function mutate(kind, details) {
  return runConfirmed(() => saveMutation({ kind, ...details }));
}

// Products
export function updateProductStock(productId, stock) {
  const expectedStock = getProducts().find((item) => item.id === productId)?.stock;
  return mutate("setProductStock", { productId, stock, expectedStock });
}

export function addProduct(product) {
  return mutate("addProduct", { product: structuredClone(product) });
}

export function updateProduct(productId, updates, displayedProduct) {
  const expected = displayedProduct === undefined
    ? getProducts().find((item) => item.id === productId) : displayedProduct;
  return mutate("updateProduct", { productId, updates: structuredClone(updates),
    expected: structuredClone(expected) });
}

export function deleteProduct(productId, displayedProduct) {
  const expected = displayedProduct === undefined
    ? getProducts().find((item) => item.id === productId) : displayedProduct;
  if (!expected) return Promise.resolve(false);
  return mutate("deleteProduct", { productId, expected: structuredClone(expected) });
}

// Transactions
export async function addTransaction(txn) {
  return runConfirmed(() => saveSale(structuredClone(txn)));
}

export function deleteTransaction(transactionId, displayedTransaction) {
  const expected = displayedTransaction === undefined
    ? getTransactions().find((item) => item.id === transactionId) : displayedTransaction;
  if (!expected) return Promise.resolve(false);
  return mutate("deleteTransaction", { transactionId, expected: structuredClone(expected) });
}

export function deleteTransactionItem(transactionId, itemIndex, displayedTransaction) {
  const expected = displayedTransaction === undefined
    ? getTransactions().find((item) => item.id === transactionId) : displayedTransaction;
  if (!expected?.items?.[itemIndex]) return Promise.resolve(false);
  return mutate("deleteTransactionItem", { transactionId, itemIndex,
    expected: structuredClone(expected) });
}

// Restock
export async function addRestockLog(log) {
  return runConfirmed(() => saveRestock(structuredClone(log)));
}

// Shifts
export function startShift(shift, displayedActiveId) {
  return mutate("startShift", { shift: structuredClone(shift),
    expectedActiveId: displayedActiveId === undefined
      ? getActiveShift()?.id || null : displayedActiveId,
    endTime: new Date().toISOString() });
}

export function closeShift(shiftId, closedBy = null) {
  return mutate("closeShift", { shiftId, closedBy: structuredClone(closedBy),
    endTime: new Date().toISOString() });
}

export function deleteShift(shiftId, displayedShift, displayedTransactions) {
  const expected = displayedShift === undefined
    ? getShifts().find((item) => item.id === shiftId) : displayedShift;
  if (!expected) return Promise.resolve(false);
  const expectedTransactions = displayedTransactions === undefined
    ? getTransactions().filter((item) => item.shiftId === shiftId) : displayedTransactions;
  return mutate("deleteShift", { shiftId, expected: structuredClone(expected),
    expectedTransactions: structuredClone(expectedTransactions) });
}

// Settings
export function updateSettings(updates, displayedSettings) {
  return mutate("updateSettings", { updates: structuredClone(updates),
    expected: structuredClone(displayedSettings === undefined ? getSettings() : displayedSettings) });
}

// ─── Hotel Supplies ───
export function addHotelSupply(supply) {
  return mutate("addHotelSupply", { supply: structuredClone(supply) });
}

export function updateHotelSupply(supplyId, updates, displayedSupply) {
  const expected = displayedSupply === undefined
    ? getHotelSupplies().find((item) => item.id === supplyId) : displayedSupply;
  return mutate("updateHotelSupply", { supplyId, updates: structuredClone(updates),
    expected: structuredClone(expected) });
}

export function deleteHotelSupply(supplyId, displayedSupply) {
  const expected = displayedSupply === undefined
    ? getHotelSupplies().find((item) => item.id === supplyId) : displayedSupply;
  if (!expected) return Promise.resolve(false);
  return mutate("deleteHotelSupply", { supplyId, expected: structuredClone(expected) });
}

export function addSupplyCheck(check, displayedCheck) {
  const expected = displayedCheck === undefined
    ? getSupplyChecks().find((item) => item.date === check.date) : displayedCheck;
  return mutate("upsertSupplyCheck", { check: structuredClone(check),
    expected: structuredClone(expected) });
}

export function deleteSupplyCheck(dateStr, displayedCheck) {
  const expected = displayedCheck === undefined
    ? getSupplyChecks().find((item) => item.date === dateStr) : displayedCheck;
  if (!expected) return Promise.resolve(false);
  return mutate("deleteSupplyCheck", { date: dateStr, expected: structuredClone(expected) });
}

export function addSupplyRestock(log) {
  return mutate("addSupplyRestock", { log: structuredClone(log) });
}

// ─── Listeners ───
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function notifyAll() {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error(e);
    }
  });
}
