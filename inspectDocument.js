import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import * as fs from "fs";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCDW74wCwmZTyaFToZPLeEtk0piTLF40n0",
  authDomain: "chomdoi-house.firebaseapp.com",
  projectId: "chomdoi-house",
};

async function test() {
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);
  const docRef = doc(db, "stores", "chomdoi_main");

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      
      console.log("=== Document Inspection ===");
      console.log("Products count:", data.products?.length || 0);
      console.log("Transactions count:", data.transactions?.length || 0);
      console.log("Shifts count:", data.shifts?.length || 0);
      console.log("Restock logs count:", data.restockLogs?.length || 0);
      console.log("Users count:", data.users?.length || 0);
      console.log("Supply checks count:", data.supplyChecks?.length || 0);
      console.log("Supply restocks count:", data.supplyRestocks?.length || 0);
      
      // Calculate sizes in JSON bytes
      const sizes = {
        products: Buffer.byteLength(JSON.stringify(data.products || [])),
        transactions: Buffer.byteLength(JSON.stringify(data.transactions || [])),
        shifts: Buffer.byteLength(JSON.stringify(data.shifts || [])),
        restockLogs: Buffer.byteLength(JSON.stringify(data.restockLogs || [])),
        supplyChecks: Buffer.byteLength(JSON.stringify(data.supplyChecks || [])),
        supplyRestocks: Buffer.byteLength(JSON.stringify(data.supplyRestocks || [])),
        settings: Buffer.byteLength(JSON.stringify(data.settings || {})),
      };
      
      console.log("\nApproximate sizes in bytes:");
      Object.entries(sizes).forEach(([key, val]) => {
        console.log(`- ${key}: ${(val / 1024).toFixed(2)} KB (${val} bytes)`);
      });
      
      // Write a full backup file locally before doing any changes
      const backupPath = "./chomdoi_main_backup.json";
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
      console.log(`\nSaved a full backup of the current database to: ${backupPath}`);
    } else {
      console.log("Document does not exist");
    }
  } catch (err) {
    console.error("Firestore operation failed:", err);
  }
}

test();
