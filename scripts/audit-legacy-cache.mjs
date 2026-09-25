// Read-only comparison of a legacy browser export against a Firestore snapshot.
// The CLI prints counts only; it never prints passwords, LINE settings, or sales.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const COLLECTIONS = [
  ["transactions", "id"],
  ["restockLogs", "id"],
  ["shifts", "id"],
  ["products", "id"],
  ["hotelSupplies", "id"],
  ["supplyChecks", "date"],
  ["supplyRestocks", "id"],
];

function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalized(value[key])]));
  }
  return value;
}

function indexedRecords(store, field, key) {
  const records = store[field] ?? [];
  if (!Array.isArray(records)) throw new Error(`${field} must be an array`);
  const indexed = new Map();
  for (const record of records) {
    const id = record?.[key];
    if (typeof id !== "string" || !id || indexed.has(id)) {
      throw new Error(`${field} has a missing or duplicate ${key}`);
    }
    indexed.set(id, record);
  }
  return indexed;
}

export function auditLegacySnapshots(server, device) {
  if (!server || !device || typeof server !== "object" || typeof device !== "object") {
    throw new Error("Two store snapshots are required");
  }
  const collections = {};
  for (const [field, key] of COLLECTIONS) {
    const remote = indexedRecords(server, field, key);
    const local = indexedRecords(device, field, key);
    const onlyOnDevice = [...local.keys()].filter((id) => !remote.has(id));
    const onlyOnServer = [...remote.keys()].filter((id) => !local.has(id));
    const changedOnBoth = [...local.keys()].filter((id) => remote.has(id)
      && JSON.stringify(normalized(local.get(id))) !== JSON.stringify(normalized(remote.get(id))));
    collections[field] = { onlyOnDevice, onlyOnServer, changedOnBoth };
  }
  const remoteProducts = indexedRecords(server, "products", "id");
  const localProducts = indexedRecords(device, "products", "id");
  const stockDifferences = [...localProducts.keys()].filter((id) => remoteProducts.has(id)
    && localProducts.get(id).stock !== remoteProducts.get(id).stock);
  return {
    collections,
    stockDifferences,
    requiresManualReview: Object.values(collections).some((item) =>
      item.onlyOnDevice.length > 0 || item.changedOnBoth.length > 0)
      || stockDifferences.length > 0,
  };
}

function firestoreValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {})
    .map(([key, nested]) => [key, firestoreValue(nested)]));
  throw new Error("Unsupported Firestore field type");
}

function readStore(filename) {
  const data = JSON.parse(readFileSync(filename, "utf8"));
  return data?.fields && data?.name
    ? Object.fromEntries(Object.entries(data.fields).map(([key, value]) => [key, firestoreValue(value)]))
    : data;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 4) {
    throw new Error("Usage: node scripts/audit-legacy-cache.mjs <server-json> <device-json>");
  }
  const audit = auditLegacySnapshots(readStore(process.argv[2]), readStore(process.argv[3]));
  const counts = Object.fromEntries(Object.entries(audit.collections).map(([name, result]) => [name, {
    onlyOnDevice: result.onlyOnDevice.length,
    onlyOnServer: result.onlyOnServer.length,
    changedOnBoth: result.changedOnBoth.length,
  }]));
  process.stdout.write(`${JSON.stringify({
    collections: counts,
    stockDifferences: audit.stockDifferences.length,
    requiresManualReview: audit.requiresManualReview,
  }, null, 2)}\n`);
}
