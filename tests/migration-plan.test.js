import { describe, expect, it } from "vitest";
import { buildMigrationPlan } from "../scripts/migration-plan.mjs";

describe("offline migration plan with synthetic identities", () => {
  it("maps existing app users, removes passwords, and retains LINE settings", () => {
    const plan = buildMigrationPlan({
      products: [], transactions: [],
      settings: { line: { channelAccessToken: "synthetic-token", enabled: true } },
      users: [{
        id: "legacy-1", username: "cashier", displayName: "Cashier",
        role: "user", active: true,
        password: "synthetic-password",
        plainPassword: "synthetic-password",
        passwordHash: "synthetic-hash",
      }],
    }, [
      { localId: "auth-1", email: "cashier@chomdoi.local" },
      { localId: "auth-extra", email: "extra@chomdoi.local" },
    ]);
    expect(plan.staffDocs).toEqual([{
      uid: "auth-1", legacyId: "legacy-1", username: "cashier",
      displayName: "Cashier", role: "user", active: true,
    }]);
    expect(plan.unmatchedAuthCount).toBe(1);
    expect(plan.hasLineToken).toBe(true);
    expect(plan.cleanedStore).not.toHaveProperty("users");
    expect(plan.cleanedStore.settings.line).toEqual({ channelAccessToken: "synthetic-token", enabled: true });
    expect(JSON.stringify(plan.staffDocs)).not.toMatch(/synthetic-password|synthetic-token|synthetic-hash/);
  });

  it("halts on duplicate usernames instead of assigning ambiguous access", () => {
    expect(() => buildMigrationPlan({
      settings: {},
      users: [
        { id: "one", username: "Cashier", role: "user" },
        { id: "two", username: "cashier", role: "admin" },
      ],
    }, [])).toThrow("duplicate username");
  });
});
