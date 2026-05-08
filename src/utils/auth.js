// auth.js — Authentication & Session Management
import { getFirebaseAuth } from '../data/db.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, signOut as fbSignOut } from 'firebase/auth';

const SESSION_KEY = 'chomdoi_session';

// ─── Simple Hash (not cryptographic, just obfuscation for internal tool) ───
export function hashPassword(password) {
  let hash = 0;
  const str = `chomdoi_salt_${password}_2024`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit int
  }
  return hash.toString(36);
}

// ─── Session ───
export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setCurrentUser(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export async function logout() {
  const auth = getFirebaseAuth();
  if (auth) {
    try { await fbSignOut(auth); } catch (e) { console.warn(e); }
  }
  sessionStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}

export function isAdmin() {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

// ─── Login Validation ───
// Local hash is the source of truth. Firebase Auth is best-effort for Firestore access.
export async function login(users, username, password) {
  if (!users || users.length === 0) return null;

  // Step 1: Check local credentials (source of truth)
  const hashed = hashPassword(password);
  const user = users.find(u =>
    u.username.toLowerCase() === username.toLowerCase().trim() &&
    u.passwordHash === hashed &&
    u.active !== false
  );

  if (!user) return null; // Wrong credentials or disabled

  // Step 2: Try Firebase Auth (best-effort, don't block login if it fails)
  const auth = getFirebaseAuth();
  if (auth) {
    const email = username.toLowerCase().trim() + '@chomdoi.local';
    try {
      // Try signing in with current password
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // If password was updated locally, sync to Firebase Auth
      if (cred.user) {
        // Password matches Firebase Auth — all good
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        // Firebase Auth doesn't have this user, or has stale password
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createErr) {
          if (createErr.code === 'auth/email-already-in-use') {
            // Firebase Auth has old password. Can't sync without admin SDK.
            // Login still proceeds — local hash matched.
            console.warn('Firebase Auth password out of sync for:', username);
          }
          // Other errors: just log and continue
        }
      }
      // Other Firebase Auth errors: log and continue
      // Local hash matched, so login should succeed
    }
  }

  // Step 3: Create session
  const session = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
  setCurrentUser(session);
  return session;
}
