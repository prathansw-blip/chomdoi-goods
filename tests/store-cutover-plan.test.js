import { describe, expect, it } from "vitest";
import { buildStoreCutoverWrite } from "../scripts/store-cutover-plan.mjs";

const name = "projects/demo-chomdoi-tests/databases/(default)/documents/stores/chomdoi_main";
function legacyDocument() {
  return {
    name,
    updateTime: "2026-09-25T01:02:03.000000Z",
    fields: {
      products: { arrayValue: { values: [] } },
      transactions: { arrayValue: { values: [] } },
      settings: { mapValue: { fields: { line: { mapValue: { fields: {
        channelAccessToken: { stringValue: "synthetic-secret" },
      } } } } } },
      users: { arrayValue: { values: Array.from({ length: 5 }, (_, index) => ({
        mapValue: { fields: { username: { stringValue: `staff-${index}` }, password: { stringValue: "synthetic-password" } } },
      })) } },
    },
  };
}

describe("legacy store cutover write", () => {
  it("deletes users, adds revision, and preserves every other field under an updateTime precondition", () => {
    const document = legacyDocument();
    const { write, expectedFields } = buildStoreCutoverWrite(document, name);
    expect(write.updateMask.fieldPaths).toEqual(["users", "revision"]);
    expect(write.currentDocument.updateTime).toBe(document.updateTime);
    expect(write.update.fields).toEqual({ revision: { integerValue: "0" } });
    expect(JSON.stringify(write)).not.toMatch(/synthetic-secret|synthetic-password/);
    expect(expectedFields).not.toHaveProperty("users");
    expect(expectedFields.revision).toEqual({ integerValue: "0" });
    expect(expectedFields.settings).toEqual(document.fields.settings);
    expect(document.fields.users.arrayValue.values).toHaveLength(5);
  });

  it("stops if the source document is already migrated or has the wrong staff count", () => {
    const migrated = legacyDocument();
    migrated.fields.revision = { integerValue: "0" };
    expect(() => buildStoreCutoverWrite(migrated, name)).toThrow("already has a revision");
    const changed = legacyDocument();
    changed.fields.users.arrayValue.values.pop();
    expect(() => buildStoreCutoverWrite(changed, name)).toThrow("staff count changed");
  });
});
