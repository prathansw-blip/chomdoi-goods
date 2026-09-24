// Apply one user action to the latest Firestore document inside a transaction.
// Return only the top-level fields changed by that action.
function same(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => same(value, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return same(leftKeys, rightKeys) && leftKeys.every((key) => same(left[key], right[key]));
}

function conflict() {
  throw new Error("SYNC_CONFLICT: data changed on another device; reload and try again");
}

function changedFields(current, expected, updates) {
  const changed = {};
  for (const [key, value] of Object.entries(updates)) {
    if (same(value, expected?.[key]) || same(value, current[key])) continue;
    if (!same(current[key], expected?.[key])) conflict();
    changed[key] = value;
  }
  return changed;
}

function restoreItems(products, items) {
  const restored = products.map((product) => ({ ...product }));
  for (const item of items) {
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) throw new Error("INVALID_SALE_ITEM");
    const matches = restored.filter((product) =>
      product.id === item.productId || (!item.productId && product.name === item.name));
    if (matches.length !== 1) throw new Error("PRODUCT_NOT_FOUND: cannot restore stock");
    const product = matches[0];
    if (!Number.isSafeInteger(product.stock) || product.stock < 0) throw new Error("INVALID_STOCK");
    product.stock += item.qty;
  }
  return restored;
}

function existingById(items, id) {
  return (items || []).find((item) => item.id === id);
}

export function applyStoreOperation(store, operation) {
  const op = operation || {};
  switch (op.kind) {
    case "setProductStock": {
      if (!Number.isSafeInteger(op.stock) || op.stock < 0) throw new Error("INVALID_STOCK");
      const current = existingById(store.products, op.productId);
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      if (current.stock === op.stock) return null;
      if (current.stock !== op.expectedStock) conflict();
      return { products: store.products.map((item) =>
        item.id === op.productId ? { ...item, stock: op.stock } : item) };
    }
    case "addProduct": {
      if (!op.product?.id || !Number.isSafeInteger(op.product.stock) || op.product.stock < 0) {
        throw new Error("INVALID_PRODUCT");
      }
      const current = existingById(store.products, op.product.id);
      if (current) {
        if (same(current, op.product)) return null;
        throw new Error("PRODUCT_ALREADY_EXISTS");
      }
      return { products: [...store.products, op.product] };
    }
    case "updateProduct": {
      const current = existingById(store.products, op.productId);
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      const changes = changedFields(current, op.expected, op.updates);
      if ("stock" in changes && (!Number.isSafeInteger(changes.stock) || changes.stock < 0)) {
        throw new Error("INVALID_STOCK");
      }
      if (!Object.keys(changes).length) return null;
      return { products: store.products.map((item) =>
        item.id === op.productId ? { ...item, ...changes } : item) };
    }
    case "deleteProduct": {
      const current = existingById(store.products, op.productId);
      if (!current) return null;
      if (!same(current, op.expected)) conflict();
      return { products: store.products.filter((item) => item.id !== op.productId) };
    }
    case "deleteTransaction": {
      const current = existingById(store.transactions, op.transactionId);
      if (!current) return null;
      if (!same(current, op.expected)) conflict();
      return {
        products: restoreItems(store.products, current.items || []),
        transactions: store.transactions.filter((item) => item.id !== op.transactionId),
      };
    }
    case "deleteTransactionItem": {
      const current = existingById(store.transactions, op.transactionId);
      if (!current) throw new Error("TRANSACTION_NOT_FOUND");
      if (!same(current, op.expected)) conflict();
      const item = current.items?.[op.itemIndex];
      if (!item) throw new Error("SALE_ITEM_NOT_FOUND");
      const remaining = current.items.filter((_, index) => index !== op.itemIndex);
      const updated = { ...current, items: remaining,
        total: Math.max(0, (current.total || 0) - (item.subtotal || 0)) };
      return {
        products: restoreItems(store.products, [item]),
        transactions: remaining.length
          ? store.transactions.map((txn) => txn.id === current.id ? updated : txn)
          : store.transactions.filter((txn) => txn.id !== current.id),
      };
    }
    case "startShift": {
      if (!op.shift?.id) throw new Error("INVALID_SHIFT");
      if (existingById(store.shifts, op.shift.id)) return null;
      const active = (store.shifts || []).find((item) => item.status === "active");
      if ((active?.id || null) !== (op.expectedActiveId || null)) conflict();
      return { shifts: [
        ...(store.shifts || []).map((item) => item.id === active?.id
          ? { ...item, status: "closed", endTime: op.endTime } : item),
        op.shift,
      ] };
    }
    case "closeShift": {
      const current = existingById(store.shifts, op.shiftId);
      if (!current) throw new Error("SHIFT_NOT_FOUND");
      if (current.status !== "active") throw new Error("SHIFT_NOT_ACTIVE");
      const closed = { ...current, status: "closed", endTime: op.endTime };
      if (op.closedBy) closed.closedBy = op.closedBy;
      return { shifts: store.shifts.map((item) => item.id === op.shiftId ? closed : item) };
    }
    case "deleteShift": {
      const current = existingById(store.shifts, op.shiftId);
      if (!current) return null;
      if (!same(current, op.expected)) conflict();
      if (current.status === "active") throw new Error("SHIFT_ACTIVE: close the shift first");
      const linked = (store.transactions || []).filter((item) => item.shiftId === op.shiftId);
      if (!same(linked, op.expectedTransactions || [])) conflict();
      return {
        shifts: store.shifts.filter((item) => item.id !== op.shiftId),
        transactions: store.transactions.filter((item) => item.shiftId !== op.shiftId),
        products: restoreItems(store.products, linked.flatMap((item) => item.items || [])),
      };
    }
    case "updateSettings": {
      const changes = changedFields(store.settings || {}, op.expected || {}, op.updates || {});
      if (!Object.keys(changes).length) return null;
      return { settings: { ...store.settings, ...changes } };
    }
    case "addHotelSupply": {
      if (!op.supply?.id) throw new Error("INVALID_SUPPLY");
      const current = existingById(store.hotelSupplies, op.supply.id);
      if (current) {
        if (same(current, op.supply)) return null;
        throw new Error("SUPPLY_ALREADY_EXISTS");
      }
      return { hotelSupplies: [...(store.hotelSupplies || []), op.supply] };
    }
    case "updateHotelSupply": {
      const current = existingById(store.hotelSupplies, op.supplyId);
      if (!current) throw new Error("SUPPLY_NOT_FOUND");
      const changes = changedFields(current, op.expected, op.updates);
      if (!Object.keys(changes).length) return null;
      return { hotelSupplies: store.hotelSupplies.map((item) =>
        item.id === op.supplyId ? { ...item, ...changes } : item) };
    }
    case "deleteHotelSupply": {
      const current = existingById(store.hotelSupplies, op.supplyId);
      if (!current) return null;
      if (!same(current, op.expected)) conflict();
      return { hotelSupplies: store.hotelSupplies.filter((item) => item.id !== op.supplyId) };
    }
    case "upsertSupplyCheck": {
      if (!op.check?.id || !op.check.date) throw new Error("INVALID_SUPPLY_CHECK");
      const checks = store.supplyChecks || [];
      const current = checks.find((item) => item.date === op.check.date);
      if (current && same(current, op.check)) return null;
      if (!same(current, op.expected || undefined)) conflict();
      return { supplyChecks: current
        ? checks.map((item) => item.date === op.check.date ? op.check : item)
        : [...checks, op.check] };
    }
    case "deleteSupplyCheck": {
      const checks = store.supplyChecks || [];
      const current = checks.find((item) => item.date === op.date);
      if (!current) return null;
      if (!same(current, op.expected)) conflict();
      return { supplyChecks: checks.filter((item) => item.date !== op.date) };
    }
    case "addSupplyRestock": {
      if (!op.log?.id || !op.log.supplyId || !Number.isSafeInteger(op.log.qty) || op.log.qty <= 0) {
        throw new Error("INVALID_SUPPLY_RESTOCK");
      }
      if (!existingById(store.hotelSupplies, op.log.supplyId)) throw new Error("SUPPLY_NOT_FOUND");
      const logs = store.supplyRestocks || [];
      const current = existingById(logs, op.log.id);
      if (current) {
        if (same(current, op.log)) return null;
        throw new Error("RESTOCK_ALREADY_EXISTS");
      }
      return { supplyRestocks: [...logs, op.log] };
    }
    default:
      throw new Error("UNKNOWN_STORE_OPERATION");
  }
}
