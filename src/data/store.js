// store.js — Reactive data store
import {
  loadData,
  saveData,
  subscribeToChanges,
  unsubscribeAll,
} from "./db.js";

let state = null;
let listeners = [];
let saveTimer = null;
let lastCommitTime = 0; // ป้องกัน Firestore revert ทับ local changes

// ─── Init ───
export async function initStore() {
  unsubscribeAll();
  state = await loadData();
  lastCommitTime = 0;

  // Migration: backfill businessDate on old transactions
  migrateTransactionBusinessDates();

  // Listen for Firebase real-time changes
  subscribeToChanges((newData) => {
    // ถ้าเพิ่งทำ local change ไป (เช่น เปิดกะ, ขายสินค้า) ไม่ต้องให้ Firestore revert ทับ
    const elapsed = Date.now() - lastCommitTime;
    if (lastCommitTime > 0 && elapsed < 3000) {
      return; // ข้าม snapshot ที่มาใน 3 วิหลัง commit
    }
    state = newData;
    notifyAll();
  });
  return state;
}

// Backfill businessDate on transactions that don't have it
function migrateTransactionBusinessDates() {
  if (!state?.transactions || !state?.shifts) return;
  let changed = false;
  state.transactions.forEach((t) => {
    if (!t.businessDate && t.shiftId) {
      const shift = state.shifts.find((s) => s.id === t.shiftId);
      if (shift?.businessDate) {
        t.businessDate = shift.businessDate;
        changed = true;
      }
    }
  });
  if (changed) {
    saveData(state);
  }
}

// ─── Getters ───
export function getState() {
  return state;
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

// ─── Mutations (auto-save) ───
function commit() {
  lastCommitTime = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveData(state), 300);
  notifyAll();
}

// Products
export function updateProductStock(productId, newStock) {
  const p = state.products.find((x) => x.id === productId);
  if (p) {
    p.stock = Math.max(0, newStock);
    commit();
  }
}

export function addProduct(product) {
  state.products.push(product);
  commit();
}

export function updateProduct(productId, updates) {
  const idx = state.products.findIndex((x) => x.id === productId);
  if (idx !== -1) {
    Object.assign(state.products[idx], updates);
    commit();
  }
}

export function deleteProduct(productId) {
  state.products = state.products.filter((x) => x.id !== productId);
  commit();
}

// Users
export function addUser(user) {
  if (!state.users) state.users = [];
  state.users.push(user);
  commit();
}

export function updateUser(userId, updates) {
  if (!state.users) return;
  const idx = state.users.findIndex((x) => x.id === userId);
  if (idx !== -1) {
    Object.assign(state.users[idx], updates);
    commit();
  }
}

export function deleteUser(userId) {
  if (!state.users) return;
  state.users = state.users.filter((x) => x.id !== userId);
  commit();
}

// Transactions
export function addTransaction(txn) {
  state.transactions.push(txn);
  // Deduct stock
  txn.items.forEach((item) => {
    updateProductStock(
      item.productId,
      (state.products.find((p) => p.id === item.productId)?.stock || 0) -
        item.qty,
    );
  });
  commit();
}

// Restock
export function addRestockLog(log) {
  state.restockLogs.push(log);
  const p = state.products.find((x) => x.id === log.productId);
  if (p) {
    p.stock += log.quantity;
  }
  commit();
}

// Shifts
export function startShift(shift) {
  // Close any active shift first
  state.shifts.forEach((s) => {
    if (s.status === "active") {
      s.status = "closed";
      s.endTime = new Date().toISOString();
    }
  });
  state.shifts.push(shift);
  commit();
}

export function closeShift(shiftId, closedBy = null) {
  const s = state.shifts.find((x) => x.id === shiftId);
  if (s) {
    s.status = "closed";
    s.endTime = new Date().toISOString();
    if (closedBy) s.closedBy = closedBy;
    commit();
  }
  return s;
}

export function deleteShift(shiftId) {
  // ลบ shift + transactions ที่ผูกกับ shift นี้
  state.shifts = state.shifts.filter((x) => x.id !== shiftId);
  state.transactions = state.transactions.filter((t) => t.shiftId !== shiftId);
  commit();
}

// Settings
export function updateSettings(updates) {
  Object.assign(state.settings, updates);
  commit();
}

// ─── Hotel Supplies ───
export function addHotelSupply(supply) {
  if (!state.hotelSupplies) state.hotelSupplies = [];
  state.hotelSupplies.push(supply);
  commit();
}

export function updateHotelSupply(supplyId, updates) {
  if (!state.hotelSupplies) return;
  const idx = state.hotelSupplies.findIndex((x) => x.id === supplyId);
  if (idx !== -1) {
    Object.assign(state.hotelSupplies[idx], updates);
    commit();
  }
}

export function deleteHotelSupply(supplyId) {
  if (!state.hotelSupplies) return;
  state.hotelSupplies = state.hotelSupplies.filter((x) => x.id !== supplyId);
  commit();
}

export function addSupplyCheck(check) {
  if (!state.supplyChecks) state.supplyChecks = [];
  state.supplyChecks.push(check);
  commit();
}

export function addSupplyRestock(log) {
  if (!state.supplyRestocks) state.supplyRestocks = [];
  state.supplyRestocks.push(log);
  commit();
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
