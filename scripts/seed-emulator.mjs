import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { defaultSettings } from "../src/data/seedData.js";

const projectId = "demo-chomdoi-tests";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const localAddress = /^(127\.0\.0\.1|localhost):[0-9]+$/;
if (!localAddress.test(firestoreHost || "") || !localAddress.test(authHost || "")) {
  throw new Error("Both local Firebase emulators are required; refusing to seed any other project");
}

const demoPassword = process.env.CHOMDOI_EMULATOR_PASSWORD || "demo-only-password";
const users = [
  { username: "admin", displayName: "Demo Admin", role: "admin" },
  { username: "cashier", displayName: "Demo Cashier", role: "user" },
];

for (const user of users) {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${user.username}@chomdoi.local`,
        password: demoPassword,
        returnSecureToken: true,
      }),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.localId) {
    throw new Error(`Auth Emulator seed failed for ${user.username}: ${result.error?.message || response.status}`);
  }
  user.uid = result.localId;
}

const [host, portText] = firestoreHost.split(":");
const env = await initializeTestEnvironment({
  projectId,
  firestore: { host, port: Number(portText) },
});
try {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("stores/chomdoi_main").set({
      products: [{
        id: "demo-product", name: "Demo product", category: "demo",
        price: 10, stock: 20, lowStockThreshold: 3, image: "📦",
      }],
      transactions: [],
      restockLogs: [],
      shifts: [],
      hotelSupplies: [],
      supplyChecks: [],
      supplyRestocks: [],
      settings: {
        ...structuredClone(defaultSettings),
        companyName: "Chomdoi Emulator",
        companyLogo: null,
        currency: "฿",
        categories: [{ id: "demo", name: "Demo", icon: "📦" }],
        line: { enabled: false, notifications: {} },
      },
      revision: 0,
    });
    for (const user of users) {
      await db.doc(`staff/${user.uid}`).set({
        uid: user.uid,
        legacyId: `demo-${user.username}`,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        active: true,
      });
    }
  });
} finally {
  await env.cleanup();
}
process.stdout.write("Seeded synthetic store and two staff accounts in local emulators.\n");
