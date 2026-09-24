// Pure restock calculation shared by the app and Emulator tests.
export function applyRestock(store, log) {
  if (
    !log?.id || !log.productId ||
    !Number.isSafeInteger(log.quantity) || log.quantity <= 0
  ) throw new Error("INVALID_RESTOCK");
  const restockLogs = store.restockLogs || [];
  if (restockLogs.some((existing) => existing.id === log.id)) return null;

  let found = false;
  const products = (store.products || []).map((product) => {
    if (product.id !== log.productId) return product;
    found = true;
    if (!Number.isSafeInteger(product.stock) || product.stock < 0) {
      throw new Error("INVALID_STOCK");
    }
    return { ...product, stock: product.stock + log.quantity };
  });
  if (!found) throw new Error("PRODUCT_NOT_FOUND");
  return { products, restockLogs: [...restockLogs, log] };
}
