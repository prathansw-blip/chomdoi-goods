// Pure, read-only preparation for the legacy-store cutover.
// The returned Write changes only users and revision, with a server updateTime precondition.
export function buildStoreCutoverWrite(document, expectedName) {
  if (!document || document.name !== expectedName || !document.updateTime || !document.fields) {
    throw new Error("Unexpected Firestore document identity");
  }
  const fields = document.fields;
  if (!fields.products?.arrayValue || !fields.transactions?.arrayValue
      || !fields.settings?.mapValue || !fields.users?.arrayValue) {
    throw new Error("Required legacy store fields are missing");
  }
  if (fields.revision) throw new Error("Store already has a revision field");
  const users = fields.users.arrayValue.values || [];
  if (users.length !== 5) throw new Error("Legacy staff count changed");

  const expectedFields = structuredClone(fields);
  delete expectedFields.users;
  expectedFields.revision = { integerValue: "0" };
  return {
    write: {
      update: {
        name: document.name,
        fields: { revision: { integerValue: "0" } },
      },
      updateMask: { fieldPaths: ["users", "revision"] },
      currentDocument: { updateTime: document.updateTime },
    },
    expectedFields,
  };
}
