// Pure sale calculation shared by the app and the emulator concurrency tests.
export function applySale(store, sale) {
  if (!sale?.id || !Array.isArray(sale.items) || sale.items.length === 0) {
    throw new Error("INVALID_SALE");
  }
  const transactions = store.transactions || [];
  if (transactions.some((existing) => existing.id === sale.id)) {
    return null; // An exact retry must not deduct stock twice.
  }
  if (sale.shiftId && !(store.shifts || []).some(
    (shift) => shift.id === sale.shiftId && shift.status === "active")) {
    throw new Error("SHIFT_NOT_ACTIVE");
  }

  const quantities = new Map();
  for (const item of sale.items) {
    if (!item.productId || !Number.isSafeInteger(item.qty) || item.qty <= 0) {
      throw new Error("INVALID_SALE_ITEM");
    }
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.qty);
  }

  const products = (store.products || []).map((product) => {
    const quantity = quantities.get(product.id) || 0;
    if (!quantity) return product;
    if (!Number.isSafeInteger(product.stock) || product.stock < quantity) {
      throw new Error("INSUFFICIENT_STOCK");
    }
    quantities.delete(product.id);
    return { ...product, stock: product.stock - quantity };
  });
  if (quantities.size) throw new Error("PRODUCT_NOT_FOUND");

  return { products, transactions: [...transactions, sale] };
}

// A Firestore rule revision check can return permission-denied before the SDK
// classifies a simultaneous update as a transaction conflict. A fresh attempt
// reads the new revision; non-concurrency denials remain failures after a cap.
export async function retryRevisionTransaction(attempt, maxAttempts = 5) {
  for (let index = 0; index < maxAttempts; index += 1) {
    try {
      return await attempt();
    } catch (error) {
      const code = error?.code;
      if (
        index === maxAttempts - 1 ||
        (code !== "permission-denied" && code !== "aborted")
      ) throw error;
    }
  }
}
