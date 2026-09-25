import { describe, expect, it } from "vitest";
import { auditLegacySnapshots } from "../scripts/audit-legacy-cache.mjs";

describe("legacy browser cache audit", () => {
  it("flags device-only sales and stock differences without reading credentials", () => {
    const server = {
      transactions: [{ id: "server-sale", total: 10 }],
      products: [{ id: "product-1", stock: 9 }],
      users: [{ password: "server-secret" }],
      settings: { line: { channelAccessToken: "server-token" } },
    };
    const device = {
      transactions: [{ id: "device-sale", total: 20 }],
      products: [{ id: "product-1", stock: 8 }],
      users: [{ password: "device-secret" }],
      settings: { line: { channelAccessToken: "device-token" } },
    };
    const result = auditLegacySnapshots(server, device);
    expect(result.collections.transactions.onlyOnDevice).toEqual(["device-sale"]);
    expect(result.collections.transactions.onlyOnServer).toEqual(["server-sale"]);
    expect(result.stockDifferences).toEqual(["product-1"]);
    expect(result.requiresManualReview).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/secret|token/);
  });

  it("distinguishes a newer server record from a device-only change", () => {
    const server = { transactions: [{ id: "sale-1", total: 10 }, { id: "sale-2", total: 15 }] };
    const device = { transactions: [{ id: "sale-1", total: 10 }] };
    const result = auditLegacySnapshots(server, device);
    expect(result.collections.transactions.onlyOnServer).toEqual(["sale-2"]);
    expect(result.requiresManualReview).toBe(false);
  });

  it("flags changed details under the same sale ID for manual reconciliation", () => {
    const server = { transactions: [{ id: "sale-1", items: [{ qty: 1 }], total: 10 }] };
    const device = { transactions: [{ id: "sale-1", items: [{ qty: 2 }], total: 20 }] };
    const result = auditLegacySnapshots(server, device);
    expect(result.collections.transactions.changedOnBoth).toEqual(["sale-1"]);
    expect(result.requiresManualReview).toBe(true);
  });

  it("rejects duplicate IDs so the audit cannot silently miss a sale", () => {
    const duplicated = { transactions: [{ id: "sale-1" }, { id: "sale-1" }] };
    expect(() => auditLegacySnapshots({}, duplicated)).toThrow("duplicate id");
  });
});
