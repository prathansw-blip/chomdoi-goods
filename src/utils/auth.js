// Authentication is based on Firebase Auth plus an active /staff/{uid} record.
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  FIREBASE_CONFIG,
  getDb,
  getFirebaseAuth,
  initFirebase,
} from "../data/db.js";

let currentUser = null;
let stopStaffListener = null;
let authGeneration = 0;

function firebaseServices() {
  initFirebase(FIREBASE_CONFIG);
  const auth = getFirebaseAuth();
  const db = getDb();
  if (!auth || !db) throw new Error("Firebase is unavailable");
  return { auth, db };
}

function asSession(uid, staff) {
  if (
    !staff || staff.uid !== uid || staff.active !== true ||
    !["admin", "user"].includes(staff.role) ||
    typeof staff.legacyId !== "string" ||
    typeof staff.username !== "string" ||
    typeof staff.displayName !== "string"
  ) return null;
  return {
    uid,
    id: staff.legacyId,
    username: staff.username,
    displayName: staff.displayName,
    role: staff.role,
  };
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("chomdoi-auth-changed"));
  }
}

async function loadStaff(uid, generation) {
  const { auth, db } = firebaseServices();
  const ref = doc(db, "staff", uid);
  const snapshot = await getDocFromServer(ref);
  const session = snapshot.exists() ? asSession(uid, snapshot.data()) : null;
  if (generation !== authGeneration || auth.currentUser?.uid !== uid) return null;
  if (!session) return null;

  currentUser = session;
  stopStaffListener?.();
  stopStaffListener = onSnapshot(ref, (next) => {
    if (generation !== authGeneration || auth.currentUser?.uid !== uid) return;
    const updated = next.exists() ? asSession(uid, next.data()) : null;
    if (!updated) {
      void logout();
      return;
    }
    currentUser = updated;
    notifyAuthChanged();
  }, () => {
    // Server rules still enforce access even if this UI listener fails.
    void logout();
  });
  notifyAuthChanged();
  return session;
}

export function getCurrentUser() {
  const auth = getFirebaseAuth();
  return currentUser && auth?.currentUser?.uid === currentUser.uid ? currentUser : null;
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}

export function isAdmin() {
  return getCurrentUser()?.role === "admin";
}

export async function restoreSession() {
  const { auth } = firebaseServices();
  const user = await new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      unsubscribe();
      resolve(next);
    }, reject);
  });
  if (!user) return null;
  const generation = ++authGeneration;
  try {
    const session = await loadStaff(user.uid, generation);
    if (!session) await logout();
    return session;
  } catch {
    await logout();
    return null;
  }
}

export async function login(username, password) {
  if (!username || !password) return null;
  const cleanUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(cleanUsername)) return null;
  const generation = ++authGeneration;
  currentUser = null;
  stopStaffListener?.();
  stopStaffListener = null;
  try {
    const { auth } = firebaseServices();
    const credential = await signInWithEmailAndPassword(
      auth, `${cleanUsername}@chomdoi.local`, password,
    );
    const staff = await loadStaff(credential.user.uid, generation);
    if (!staff || staff.username.toLowerCase() !== cleanUsername) {
      await logout();
      return null;
    }
    return staff;
  } catch {
    await logout();
    return null;
  }
}

export async function logout() {
  ++authGeneration;
  currentUser = null;
  stopStaffListener?.();
  stopStaffListener = null;
  notifyAuthChanged();
  const auth = getFirebaseAuth();
  if (auth) {
    try { await signOut(auth); } catch { /* The local profile is already cleared. */ }
  }
}
