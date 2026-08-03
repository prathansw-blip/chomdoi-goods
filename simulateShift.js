import { initStore, startShift, subscribe, getState } from "./src/data/store.js";
import { generateId, getBusinessDate } from "./src/utils/utils.js";

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
global.sessionStorage = sessionStorageMock;

async function run() {
  console.log("=== Starting Simulation ===");
  
  // Subscribe to store changes
  subscribe((state) => {
    const active = state?.shifts?.find(s => s.status === 'active');
    console.log(`[Store Subscribe Notification] Active Shift: ${active ? active.name : 'None'} (Shifts Count: ${state?.shifts?.length || 0})`);
  });

  console.log("Initializing store...");
  await initStore();
  
  const initialState = getState();
  console.log("Initial Shifts Count:", initialState?.shifts?.length || 0);
  const initialActive = initialState?.shifts?.find(s => s.status === 'active');
  console.log("Initial Active Shift:", initialActive ? initialActive.name : 'None');

  // If there is an active shift, close it first so we can test startShift
  if (initialActive) {
    console.log("Found active shift, closing it for clean test...");
    // Let's manually remove active status
    initialState.shifts.forEach(s => {
      if (s.status === 'active') s.status = 'closed';
    });
  }

  console.log("\nCalling startShift in 1 second...");
  await new Promise(r => setTimeout(r, 1000));

  const testShift = {
    id: generateId("shift"),
    defId: "shift_morning",
    name: "กะเช้า (08:00-17:00)",
    icon: "🌅",
    startTime: new Date().toISOString(),
    endTime: null,
    status: "active",
    businessDate: getBusinessDate(new Date(), 8),
    openedBy: { id: "test", displayName: "Tester" }
  };

  console.log("Starting shift...");
  startShift(testShift);

  console.log("Waiting 3 seconds to see if it persists or bounces back...");
  await new Promise(r => setTimeout(r, 3000));

  const finalState = getState();
  const finalActive = finalState?.shifts?.find(s => s.status === 'active');
  console.log("\nSimulation finished.");
  console.log("Final Active Shift:", finalActive ? finalActive.name : 'None');
  console.log("Final Shifts Count:", finalState?.shifts?.length || 0);
  
  process.exit(0);
}

run().catch(err => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
