import { describe, expect, it, vi } from "vitest";
import { preserveLegacyCache, RECOVERY_PREFIX } from "../src/data/legacy-cache.js";
import { auditLegacySnapshots } from "../scripts/audit-legacy-cache.mjs";

const legacyKey = "chomdoi_goods_data";
const capturedAt = "2026-09-26T03:30:00.000Z";
function legacy() {
  return {
    products: [{ id: "p1", stock: 8, price: 20 }],
    transactions: [{ id: "sale-local", cashier: { username: "staff", passwordHash: "synthetic-hash" }, total: 20 }],
    restockLogs: [{ id: "r-local", quantity: 2 }],
    shifts: [{ id: "shift-local" }],
    hotelSupplies: [{ id: "s1", stock: 4 }],
    supplyChecks: [{ date: "2026-09-26", items: [{ id: "s1", remaining: 4 }] }],
    supplyRestocks: [{ id: "sr-local" }],
    users: [{ password: "synthetic-password" }],
    settings: { line: { channelAccessToken: "synthetic-token" } },
  };
}
function storage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: key => items.delete(key),
  };
}

describe("legacy device recovery", () => {
  it("archives at app initialization while keeping old sales out of the live store", async () => {
    const cache = storage({ [legacyKey]: JSON.stringify(legacy()) });
    vi.resetModules();
    vi.stubGlobal("localStorage", cache);
    try {
      const { initStoreSync } = await import("../src/data/store.js");
      const state = initStoreSync();
      expect(state.transactions.some(sale => sale.id === "sale-local")).toBe(false);
      expect(cache.getItem(legacyKey)).toBeNull();
      const archiveKeys = [...cache.items.keys()].filter(key => key.startsWith(RECOVERY_PREFIX));
      expect(archiveKeys).toHaveLength(1);
      expect(JSON.parse(cache.getItem(archiveKeys[0])).snapshot.transactions[0].id).toBe("sale-local");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves local-only sales and stock records without passwords, users or LINE settings", () => {
    const cache = storage({ [legacyKey]: JSON.stringify(legacy()) });
    const result = preserveLegacyCache(cache, capturedAt);
    expect(result.status).toBe("archived");
    expect(cache.getItem(legacyKey)).toBeNull();
    const bytes = cache.getItem(result.key);
    expect(bytes).not.toMatch(/synthetic-password|synthetic-token|synthetic-hash|passwordHash|channelAccessToken/);
    const recovery = JSON.parse(bytes);
    expect(recovery.snapshot.transactions[0].id).toBe("sale-local");
    expect(recovery.snapshot.products[0].stock).toBe(8);
    expect(recovery.snapshot.supplyRestocks[0].id).toBe("sr-local");
    expect(recovery.snapshot).not.toHaveProperty("users");
    expect(recovery.snapshot).not.toHaveProperty("settings");
    const audit = auditLegacySnapshots({ products: legacy().products, transactions: [] }, recovery);
    expect(audit.collections.transactions.onlyOnDevice).toEqual(["sale-local"]);
    expect(audit.requiresManualReview).toBe(true);
  });

  it("keeps previous recovery copies when an old tab produces another snapshot", () => {
    const previous = JSON.stringify({ snapshot: { transactions: [{ id: "previous-sale" }] } });
    const cache = storage({ [RECOVERY_PREFIX + capturedAt]: previous, [legacyKey]: JSON.stringify(legacy()) });
    const result = preserveLegacyCache(cache, capturedAt);
    expect(result.key).not.toBe(RECOVERY_PREFIX + capturedAt);
    expect(cache.getItem(RECOVERY_PREFIX + capturedAt)).toBe(previous);
    preserveLegacyCache(cache, capturedAt);
    expect(cache.getItem(result.key)).not.toBeNull();
  });

  it("keeps a sanitized source copy when an extra archive exceeds storage quota", () => {
    const cache = storage({ [legacyKey]: JSON.stringify(legacy()) });
    const originalSet = cache.setItem;
    cache.setItem = (key, value) => {
      if (key.startsWith(RECOVERY_PREFIX)) throw new Error("QuotaExceededError");
      return originalSet(key, value);
    };
    expect(preserveLegacyCache(cache, capturedAt).status).toBe("retained");
    const remaining = cache.getItem(legacyKey);
    expect(JSON.parse(remaining).transactions[0].id).toBe("sale-local");
    expect(remaining).not.toMatch(/synthetic-password|synthetic-token|synthetic-hash/);
  });

  it("leaves the original intact when parsing or storage writes fail", () => {
    const corrupt = storage({ [legacyKey]: "invalid-json" });
    expect(preserveLegacyCache(corrupt, capturedAt).status).toBe("unreadable");
    expect(corrupt.getItem(legacyKey)).toBe("invalid-json");
    const original = JSON.stringify(legacy());
    const unavailable = storage({ [legacyKey]: original });
    unavailable.setItem = () => { throw new Error("Storage unavailable"); };
    preserveLegacyCache(unavailable, capturedAt);
    expect(unavailable.getItem(legacyKey)).toBe(original);
  });

  it("does not delete a newer cache written by another tab during preservation", () => {
    const cache = storage({ [legacyKey]: JSON.stringify(legacy()) });
    const newer = JSON.stringify({ ...legacy(), transactions: [{ id: "newer-local-sale" }] });
    const originalSet = cache.setItem;
    cache.setItem = (key, value) => {
      originalSet(key, value);
      if (key.startsWith(RECOVERY_PREFIX)) originalSet(legacyKey, newer);
    };
    const result = preserveLegacyCache(cache, capturedAt);
    expect(result.status).toBe("archived");
    expect(cache.getItem(legacyKey)).toBe(newer);
    expect(JSON.parse(cache.getItem(result.key)).snapshot.transactions[0].id).toBe("sale-local");
  });
});
