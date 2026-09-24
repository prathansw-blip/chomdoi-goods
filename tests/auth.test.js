import { afterEach, describe, expect, it, vi } from "vitest";

function setupAuth({ active = true, hasStaff = true, validPassword = true } = {}) {
  let signedInUser = null;
  const auth = { get currentUser() { return signedInUser; } };
  const signInWithEmailAndPassword = vi.fn(async (_auth, email, password) => {
    if (!validPassword) throw new Error("invalid credential");
    signedInUser = { uid: "auth-uid", email };
    return { user: signedInUser };
  });
  const signOut = vi.fn(async () => { signedInUser = null; });
  vi.doMock("firebase/auth", () => ({
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged: (_auth, callback) => {
      queueMicrotask(() => callback(signedInUser));
      return () => {};
    },
  }));
  vi.doMock("firebase/firestore", () => ({
    doc: (_db, _collection, uid) => ({ uid }),
    getDocFromServer: vi.fn(async () => ({
      exists: () => hasStaff,
      data: () => ({
        uid: "auth-uid", legacyId: "legacy-user", username: "cashier",
        displayName: "Cashier", role: "user", active,
      }),
    })),
    onSnapshot: () => () => {},
  }));
  vi.doMock("../src/data/db.js", () => ({
    FIREBASE_CONFIG: { projectId: "demo-only" },
    initFirebase: () => ({}),
    getDb: () => ({}),
    getFirebaseAuth: () => auth,
  }));
  return { signInWithEmailAndPassword, signOut };
}

afterEach(() => {
  vi.doUnmock("firebase/auth");
  vi.doUnmock("firebase/firestore");
  vi.doUnmock("../src/data/db.js");
  vi.resetModules();
});

describe("Firebase Auth plus staff membership", () => {
  it("signs in an active staff member using the exact password", async () => {
    const firebase = setupAuth();
    const auth = await import("../src/utils/auth.js");
    const session = await auth.login("Cashier", "With Spaces ");
    expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(), "cashier@chomdoi.local", "With Spaces ",
    );
    expect(session).toMatchObject({ id: "legacy-user", role: "user" });
    expect(auth.getCurrentUser()).toEqual(session);
  });

  it("denies an Auth account without an active staff record", async () => {
    const firebase = setupAuth({ hasStaff: false });
    const auth = await import("../src/utils/auth.js");
    expect(await auth.login("cashier", "test-only")).toBeNull();
    expect(firebase.signOut).toHaveBeenCalledOnce();
    expect(auth.getCurrentUser()).toBeNull();
  });

  it("denies an inactive staff record", async () => {
    setupAuth({ active: false });
    const auth = await import("../src/utils/auth.js");
    expect(await auth.login("cashier", "test-only")).toBeNull();
    expect(auth.getCurrentUser()).toBeNull();
  });

  it("does not create an Auth account when the password fails", async () => {
    const firebase = setupAuth({ validPassword: false });
    const auth = await import("../src/utils/auth.js");
    expect(await auth.login("cashier", "wrong")).toBeNull();
    expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledOnce();
    expect(auth.getCurrentUser()).toBeNull();
  });
});
