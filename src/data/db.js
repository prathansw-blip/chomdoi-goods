// Firestore persistence. Financial data is never sourced from a browser cache.
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  connectFirestoreEmulator,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { defaultSettings } from "./seedData.js";
import { applySale, retryRevisionTransaction } from "./sale.js";
import { applyRestock } from "./restock.js";
import { applyStoreOperation } from "./operations.js";

let db = null;
let app = null;
let auth = null;
let unsubscribers = [];
let latestExportData = null;
const STORE_ID = "chomdoi_main";
const LS_KEY = "chomdoi_goods_data";

const emulatorMode = import.meta.env.MODE === "emulator";
export const FIREBASE_CONFIG = emulatorMode
  ? {
      apiKey: "demo-key",
      authDomain: "demo-chomdoi-tests.firebaseapp.com",
      projectId: "demo-chomdoi-tests",
    }
  : {
      apiKey: "AIzaSyCDW74wCwmZTyaFToZPLeEtk0piTLF40n0",
      authDomain: "chomdoi-house.firebaseapp.com",
      projectId: "chomdoi-house",
    };

export function initFirebase(config = FIREBASE_CONFIG) {
  if (app) return db;
  if (emulatorMode && import.meta.env.PROD) {
    throw new Error("Emulator mode cannot run in a production build");
  }
  app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
  if (emulatorMode) {
    if (typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      throw new Error("Emulator mode is restricted to localhost");
    }
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return db;
}

export function getDb() { return db; }
export function getFirebaseAuth() { return auth; }
export function isFirebaseReady() { return db !== null; }

function requireSignedIn() {
  initFirebase();
  if (!auth.currentUser) throw new Error("Sign in before accessing store data");
  return db;
}

function publicStore(data) {
  const clean = structuredClone(data);
  delete clean.users;
  clean.revision = Number.isSafeInteger(clean.revision) && clean.revision >= 0
    ? clean.revision : 0;
  return clean;
}

function userFromStaff(docSnapshot) {
  const staff = docSnapshot.data();
  return {
    id: staff.legacyId,
    uid: docSnapshot.id,
    username: staff.username,
    displayName: staff.displayName,
    role: staff.role,
    active: staff.active,
  };
}

export function getInitialDataSync() {
  return {
    products: [],
    transactions: [],
    restockLogs: [],
    shifts: [],
    users: [],
    settings: structuredClone(defaultSettings),
  };
}

export async function loadData() {
  const firestore = requireSignedIn();
  const storeRef = doc(firestore, "stores", STORE_ID);
  const [store, staff] = await Promise.all([
    getDocFromServer(storeRef),
    getDocsFromServer(collection(firestore, "staff")),
  ]);
  if (!store.exists()) throw new Error("Store document is missing; automatic seeding is disabled");
  const data = {
    ...publicStore(store.data()),
    users: staff.docs.map(userFromStaff),
  };
  latestExportData = publicStore(data);
  return data;
}

// Each action reads the latest store, changes only its own fields, and commits
// with the incremented revision. A stale edit to the same entity fails visibly.
export async function saveMutation(operation) {
  const firestore = requireSignedIn();
  const ref = doc(firestore, "stores", STORE_ID);
  const result = await retryRevisionTransaction(() => runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Store document is missing");
    const store = publicStore(snap.data());
    const changes = applyStoreOperation(store, operation);
    if (!changes) return store;
    const revision = store.revision + 1;
    transaction.update(ref, { ...changes, revision });
    return { ...store, ...changes, revision };
  }));
  latestExportData = result;
  return result;
}

export async function saveSale(sale) {
  const firestore = requireSignedIn();
  const ref = doc(firestore, "stores", STORE_ID);
  const result = await retryRevisionTransaction(() => runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Store document is missing");
    const store = publicStore(snap.data());
    const result = applySale(store, sale);
    if (!result) return store;
    const revision = store.revision + 1;
    transaction.update(ref, { ...result, revision });
    return { ...store, ...result, revision };
  }));
  latestExportData = result;
  return result;
}

export async function saveRestock(log) {
  const firestore = requireSignedIn();
  const ref = doc(firestore, "stores", STORE_ID);
  const result = await retryRevisionTransaction(() => runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Store document is missing");
    const store = publicStore(snap.data());
    const result = applyRestock(store, log);
    if (!result) return store;
    const revision = store.revision + 1;
    transaction.update(ref, { ...result, revision });
    return { ...store, ...result, revision };
  }));
  latestExportData = result;
  return result;
}

export function subscribeToChanges(callback, onError) {
  const firestore = requireSignedIn();
  const unsub = onSnapshot(doc(firestore, "stores", STORE_ID), (snap) => {
    if (snap.exists() && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites) {
      const data = publicStore(snap.data());
      latestExportData = data;
      callback(data);
    }
  }, onError);
  unsubscribers.push(unsub);
  return unsub;
}

export function unsubscribeAll() {
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
}

export function clearAllData() {
  latestExportData = null;
  localStorage.removeItem(LS_KEY);
}

export function exportData() {
  if (!latestExportData) throw new Error("Load store data before exporting");
  const blob = new Blob([JSON.stringify(latestExportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chomdoi_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
