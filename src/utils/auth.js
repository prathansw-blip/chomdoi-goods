// auth.js — Authentication & Session Management
import { getFirebaseAuth } from '../data/db.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';

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

// ─── Login Validation (Firebase Auth + Auto-migration) ───
export async function login(users, username, password) {
  if (!users || users.length === 0) return null;
  const auth = getFirebaseAuth();
  if (!auth) return null;

  const email = username.toLowerCase().trim() + '@chomdoi.local';

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      // Auto-migration: check legacy hash
      const hashed = hashPassword(password);
      const legacyUser = users.find(u =>
        u.username.toLowerCase() === username.toLowerCase().trim() &&
        u.passwordHash === hashed &&
        u.active !== false
      );
      if (legacyUser) {
        // Match! Register in Firebase Auth
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createErr) {
          console.error('Migration failed:', createErr);
          return null;
        }
      } else {
        return null;
      }
    } else {
      console.error('Login error:', err);
      return null;
    }
  }

  // Find user details for session
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim() && u.active !== false);
  if (!user) {
    await fbSignOut(auth);
    return null;
  }

  const session = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
  setCurrentUser(session);
  return session;
}
