const LEGACY_KEY = "chomdoi_goods_data";
export const RECOVERY_PREFIX = "chomdoi_legacy_recovery_";
const COLLECTIONS = [
  "products", "transactions", "restockLogs", "shifts",
  "hotelSupplies", "supplyChecks", "supplyRestocks",
];

function withoutCredentials(value) {
  if (Array.isArray(value)) return value.map(withoutCredentials);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/password|token|secret|credential/i.test(key))
      .map(([key, nested]) => [key, withoutCredentials(nested)]));
  }
  return value;
}

// The new client never loads this snapshot into live state or writes it to Firestore.
// Preserve old device records before session reset removes the legacy credential cache.
export function preserveLegacyCache(storage, capturedAt = new Date().toISOString()) {
  let raw;
  try {
    raw = storage.getItem(LEGACY_KEY);
    if (!raw) return { status: "empty" };
    const legacy = JSON.parse(raw);
    if (!Array.isArray(legacy?.products) || !Array.isArray(legacy?.transactions)) {
      return { status: "unreadable" };
    }
    const snapshot = Object.fromEntries(COLLECTIONS
      .filter(field => Array.isArray(legacy[field]))
      .map(field => [field, withoutCredentials(legacy[field])]));
    const recovery = JSON.stringify({ format: "chomdoi-legacy-recovery-v1", capturedAt, snapshot });
    let key = RECOVERY_PREFIX + capturedAt;
    let suffix = 0;
    while (storage.getItem(key) !== null) key = `${RECOVERY_PREFIX}${capturedAt}_${++suffix}`;
    try {
      storage.setItem(key, recovery);
      if (storage.getItem(key) !== recovery) throw new Error("Recovery storage verification failed");
    } catch {
      // If a second copy exceeds the quota, keep the sanitized data in its original slot.
      // A later reset can retry archiving it. Never delete the only preserved copy.
      if (storage.getItem(LEGACY_KEY) !== raw) return { status: "changed" };
      const sanitized = JSON.stringify(snapshot);
      storage.setItem(LEGACY_KEY, sanitized);
      return { status: storage.getItem(LEGACY_KEY) === sanitized ? "retained" : "failed" };
    }
    // Another old tab can still change its local cache, even when its server writes are denied.
    if (storage.getItem(LEGACY_KEY) === raw) storage.removeItem(LEGACY_KEY);
    return { status: "archived", key };
  } catch {
    return { status: raw ? "unreadable" : "failed" };
  }
}
