import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCDW74wCwmZTyaFToZPLeEtk0piTLF40n0",
  authDomain: "chomdoi-house.firebaseapp.com",
  projectId: "chomdoi-house",
};

async function test() {
  console.log("Initializing Firebase app...");
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);
  const docRef = doc(db, "stores", "chomdoi_main");

  try {
    console.log("Reading store chomdoi_main...");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log("Read success! Document exists.");
      const data = snap.data();
      console.log("Shifts count:", data.shifts?.length || 0);
      console.log("Active shift:", data.shifts?.find(s => s.status === 'active')?.name || 'None');
      
      console.log("Attempting to write back data with a test field to check permissions...");
      const originalData = JSON.parse(JSON.stringify(data));
      // Add a test field
      originalData._testWriteTime = new Date().toISOString();
      
      await setDoc(docRef, originalData);
      console.log("Write success! Permissions are correct.");
    } else {
      console.log("Document chomdoi_main does not exist!");
    }
  } catch (err) {
    console.error("Firestore operation failed:", err);
  }
}

test();
