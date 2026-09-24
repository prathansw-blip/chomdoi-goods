// Pure preparation for a later, administrator-approved migration.
// This module performs no network or filesystem access and never returns passwords.
export function buildMigrationPlan(store, authUsers) {
  if (!store || !Array.isArray(store.users) || !Array.isArray(authUsers)) {
    throw new Error("Expected a store with users and an Auth user list");
  }
  const authByEmail = new Map();
  for (const user of authUsers) {
    const email = user.email?.trim().toLowerCase();
    if (!email || !user.localId || authByEmail.has(email)) {
      throw new Error("Auth user list has a missing or duplicate email/UID");
    }
    authByEmail.set(email, user);
  }

  const staffDocs = [];
  const unmatchedAppUsers = [];
  const matchedAuthUids = new Set();
  const usernames = new Set();
  for (const user of store.users) {
    const username = user.username?.trim().toLowerCase();
    if (!username || !/^[a-z0-9._-]+$/.test(username) || usernames.has(username)) {
      throw new Error("App users have an invalid or duplicate username");
    }
    if (!user.id || !["admin", "user"].includes(user.role)) {
      throw new Error("App user has an invalid ID or role");
    }
    usernames.add(username);
    const authUser = authByEmail.get(`${username}@chomdoi.local`);
    if (!authUser) {
      unmatchedAppUsers.push(username);
      continue;
    }
    if (matchedAuthUids.has(authUser.localId)) {
      throw new Error("Multiple app users map to one Auth UID");
    }
    matchedAuthUids.add(authUser.localId);
    staffDocs.push({
      uid: authUser.localId,
      legacyId: user.id,
      username,
      displayName: user.displayName || username,
      role: user.role,
      active: user.active !== false,
    });
  }

  const cleanedStore = structuredClone(store);
  delete cleanedStore.users;
  const hasLineToken = Boolean(cleanedStore.settings?.line?.channelAccessToken);
  cleanedStore.revision = Number.isSafeInteger(cleanedStore.revision)
    ? cleanedStore.revision : 0;

  return {
    staffDocs,
    cleanedStore,
    unmatchedAppUsers,
    unmatchedAuthCount: authUsers.length - matchedAuthUids.size,
    hasLineToken,
  };
}
