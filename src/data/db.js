// db.js — Data persistence layer (Firebase Firestore + localStorage fallback)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { seedProducts, defaultSettings, createDefaultUsers } from './seedData.js';

let db = null;
let app = null;
let auth = null;
let unsubscribers = [];
const STORE_ID = 'chomdoi_main'; // single-store document id
const LS_KEY = 'chomdoi_goods_data';

// ─── Hard-coded Firebase config (ให้ทุกเครื่องเชื่อม Firestore ได้ทันที) ───
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCDW74wCwmZTyaFToZPLeEtk0piTLF40n0',
  authDomain: 'chomdoi-house.firebaseapp.com',
  projectId: 'chomdoi-house',
};

// ─── Firebase Init ───
export function initFirebase(config) {
  try {
    if (app) return db;
    app = initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    return db;
  } catch (e) {
    console.error('Firebase init failed:', e);
    return null;
  }
}

export function getDb() { return db; }
export function getFirebaseAuth() { return auth; }
export function isFirebaseReady() { return db !== null; }

// ─── Load Data ───
function waitForAuth(auth) {
  return new Promise((resolve) => {
    if (!auth) return resolve(null);
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function loadData() {
  // ── ALWAYS try Firebase first (hard-coded config) ──
  const localSettings = loadLocal()?.settings;
  const fbConfig = (localSettings?.firebase?.configured && localSettings.firebase.projectId)
    ? { apiKey: localSettings.firebase.apiKey, authDomain: localSettings.firebase.authDomain, projectId: localSettings.firebase.projectId }
    : FIREBASE_CONFIG;

  try {
    const fbDb = initFirebase(fbConfig);
    if (fbDb) {
      await waitForAuth(auth); // Wait for auth state to be restored
      const snap = await getDoc(doc(fbDb, 'stores', STORE_ID));
      if (snap.exists()) {
        const data = snap.data();
        // Ensure firebase config is always set
        if (!data.settings.firebase?.configured) {
          data.settings.firebase = { ...fbConfig, configured: true };
        }
        saveLocal(data);
        return data;
      } else {
        // Firestore is empty — push current local data or seed data
        const local = loadLocal();
        const base = (local && local.products) ? local : createSeedData();
        base.settings.firebase = { ...fbConfig, configured: true };
        await setDoc(doc(fbDb, 'stores', STORE_ID), JSON.parse(JSON.stringify(base)));
        saveLocal(base);
        return base;
      }
    }
  } catch (e) {
    console.warn('Firebase load failed, falling back to localStorage', e);
  }

  // Fallback: localStorage only
  const local = loadLocal();
  if (local && local.products) {
    local.settings = { ...defaultSettings, ...local.settings };
    if (!local.settings.shiftDefinitions) local.settings.shiftDefinitions = defaultSettings.shiftDefinitions;
    if (!local.settings.categories) local.settings.categories = defaultSettings.categories;
    if (!local.settings.theme) local.settings.theme = 'dark-gold';
    if (!local.users || local.users.length === 0) local.users = createDefaultUsers();
    saveLocal(local);
    return local;
  }
  const seed = createSeedData();
  saveLocal(seed);
  return seed;
}

// ─── Save Data ───
export async function saveData(data) {
  saveLocal(data);
  if (isFirebaseReady()) {
    try {
      await setDoc(doc(db, 'stores', STORE_ID), JSON.parse(JSON.stringify(data)));
    } catch (e) {
      console.warn('Firebase save failed:', e);
    }
  }
}

// ─── Real-time listener (Firebase) ───
export function subscribeToChanges(callback) {
  if (!isFirebaseReady()) return () => {};
  const unsub = onSnapshot(doc(db, 'stores', STORE_ID), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      // hasPendingWrites=true → ยังไม่ได้ confirm จาก server (อาจ revert ได้)
      const fromServer = !snap.metadata.hasPendingWrites;
      saveLocal(data);
      callback(data, fromServer);
    }
  });
  unsubscribers.push(unsub);
  return unsub;
}

export function unsubscribeAll() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}

// ─── localStorage helpers ───
function saveLocal(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) { console.warn('localStorage save failed', e); }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearAllData() {
  localStorage.removeItem(LS_KEY);
}

// ─── Seed ───
function createSeedData() {
  return {
    products: [...seedProducts],
    transactions: [],
    restockLogs: [],
    shifts: [],
    users: createDefaultUsers(),
    settings: { ...defaultSettings }
  };
}

export function exportData() {
  const data = loadLocal();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chomdoi_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
