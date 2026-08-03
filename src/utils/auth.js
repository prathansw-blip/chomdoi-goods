// auth.js — Authentication & Session Management
import { getFirebaseAuth, loadData } from "../data/db.js";
import { getUsers } from "../data/store.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut as fbSignOut,
} from "firebase/auth";

const SESSION_KEY = "chomdoi_session";

// ─── Simple Hash (not cryptographic, just obfuscation for internal tool) ───
export function hashPassword(password) {
  let hash = 0;
  const str = `chomdoi_salt_${password}_2024`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32bit int
  }
  return hash.toString(36);
}

// ─── Session ───
export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export async function logout() {
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn(e);
    }
  }
  sessionStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}

export function isAdmin() {
  const user = getCurrentUser();
  return user?.role === "admin";
}

// ─── Login Validation ───
// Local hash is the source of truth. Firebase Auth is best-effort for Firestore access.
export async function login(users, username, password) {
  if (!username || !password) return null;

  const cleanUsername = username.toLowerCase().trim();
  const cleanPassword = password.trim();
  const rawPassword = password;

  const matchesUser = (u) => {
    if (!u || u.active === false) return false;
    if (u.username.toLowerCase().trim() !== cleanUsername) return false;

    // 1. Plain password match (raw, trimmed, or case-insensitive)
    if (
      u.plainPassword === rawPassword ||
      u.plainPassword === cleanPassword ||
      u.password === rawPassword ||
      u.password === cleanPassword
    ) {
      return true;
    }
    if (
      u.plainPassword &&
      u.plainPassword.toLowerCase() === cleanPassword.toLowerCase()
    ) {
      return true;
    }
    if (
      u.password &&
      u.password.toLowerCase() === cleanPassword.toLowerCase()
    ) {
      return true;
    }

    // 2. Password hash match (clean or raw)
    const hashClean = hashPassword(cleanPassword);
    const hashRaw = hashPassword(rawPassword);
    if (u.passwordHash === hashClean || u.passwordHash === hashRaw) {
      return true;
    }

    return false;
  };

  // Step 1: Search in current memory state
  let currentUsers = users && users.length > 0 ? users : getUsers();
  let user = currentUsers.find(matchesUser);

  // Step 2: If not found, force fresh fetch from Firestore (in case user was created on another machine)
  if (!user) {
    try {
      const freshData = await loadData();
      if (freshData && freshData.users) {
        currentUsers = freshData.users;
        user = currentUsers.find(matchesUser);
      }
    } catch (e) {
      console.warn("Fresh loadData during login failed:", e);
    }
  }

  if (!user) return null; // Wrong credentials or disabled

  // Step 3: Try Firebase Auth (best-effort)
  const auth = getFirebaseAuth();
  if (auth) {
    const email = cleanUsername + "@chomdoi.local";
    try {
      await signInWithEmailAndPassword(auth, email, cleanPassword);
    } catch (err) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential"
      ) {
        try {
          await createUserWithEmailAndPassword(auth, email, cleanPassword);
        } catch (createErr) {
          // Ignore if email already in use
        }
      }
    }
  }

  // Step 4: Create session
  const session = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
  setCurrentUser(session);
  return session;
}
