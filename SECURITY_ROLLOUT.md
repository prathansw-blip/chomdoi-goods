# Security rollout (draft; no production changes made)

This is a deployment checklist for the proposed `firestore.secure.rules`. It is **not** safe to deploy that file alone. The currently deployed web app still logs in against `stores/chomdoi_main.users`, writes that whole document, and reads the LINE token from it.

Do not run a default `firebase deploy` from this branch. `firebase.json` still references the old public `firestore.rules`, while the candidate client requires Firebase Auth and `/staff/{uid}` records. Publishing the client or rules before the cutover steps can interrupt staff access or leave the store publicly accessible.

## Preconditions

1. Provision Firebase Auth accounts through an administrator-controlled process. A server backend is optional for provisioning later; no Cloud Functions or Blaze plan is required for the chosen LINE setup. The existing Apps Script proxy receives the token from the browser and does not protect it.
2. Implement and test a client that signs in with Firebase Auth, loads `/staff/{auth.uid}`, rejects absent/inactive staff, and never creates an Auth account during login. All app data loads and writes must wait for that check. Remove the local password/session fallback.
3. Move the staff directory to `/staff/{uid}`. Keep password fields out of staff documents, localStorage, exports, and HTML. Provision Auth accounts only through the trusted backend or an administrator-controlled process. Match existing app users to Auth UIDs and review the extra Auth accounts manually; do not grant them access automatically.
4. Keep the LINE token in `settings.line.channelAccessToken` as requested. The Settings page lets an admin edit it, but Firestore rules grant document-level reads: every active staff account that can read `/stores/chomdoi_main` can also retrieve the token. Hiding Settings from cashiers does not hide this field. The previous public rules may already have exposed the token; rotating it after cutover is recommended. Admin exports of the store also contain it.
5. Review and test every operation-specific transaction before rollout. The candidate writes only changed top-level fields after reading the latest store inside a transaction. Sales, restocks, stock edits, bill cancellation, shifts, settings, and hotel supplies now wait for confirmation before reporting success. A stale edit to the same record fails visibly. Shift deletion also restores stock for its linked sales, which is a deliberate change from the old app.
6. Run the full application against a synthetic Firestore/Auth Emulator dataset, including login, role changes, simultaneous sales, offline/reconnect, and all settings and stock flows.
7. Check every device that has used the old app for unsynced local data. Reconcile pending sales and stock changes with Firestore before clearing browser storage or switching the app. The new client intentionally does not load the old local cache.
8. Make a final encrypted, off-device backup and verify that it can be decrypted. Record the latest document update time and Auth user count before cutover.

## Cutover (requires a maintenance window and separate approval)

1. Stop staff transactions and make the final backup.
2. Publish temporary deny-all Firestore rules so the old public document cannot be read during migration.
3. With administrator credentials, create staff documents for only approved Auth UIDs and remove `users` from the store document. Keep `settings.line` intact, including its token and enabled state. Do not copy plaintext passwords into new documents.
4. Publish the new web app and `firestore.secure.rules` together. Verify unauthenticated and unapproved accounts are denied; approved staff can sign in; admins and cashiers see the correct pages; two simultaneous test sales both persist and stock reflects both.
5. Reopen transactions only after the checks pass. Monitor write failures and Auth denials.

## Rollback principle

If a cutover check fails, stop transactions and keep the database locked while repairing the app or rules. Do not restore the old public rules or old browser password flow. Restore the backed-up store only after reconciling transactions created since the backup; a blind whole-document restore would erase newer sales. The encrypted backup and detailed recovery notes are stored outside the repository under `/Users/keng/.codex/backups/chomdoi-house/`.

## Current evidence

- `tests/firestore.rules.test.js` reproduces unauthenticated access and a lost sale under the current rules.
- `tests/firestore.secure.rules.test.js` checks the proposed staff gate and rejects a stale revision.
- `tests/sale.transaction.test.js` verifies two simultaneous sales, sale/restock/cancellation concurrency, stale stock rejection, shift-close protection, settings merge, daily-check conflict, and recovery after an injected `unavailable` write failure using synthetic data. The failure injection is not a real network outage.
- `tests/store.sync.test.js` verifies that changes appear only after a confirmed write and that a failed stock edit does not overwrite a newer remote snapshot.
- The local UI smoke tests signed in as admin and cashier, opened a shift, recorded sales and a restock, and confirmed a second tab received the updated sales and stock. Additional UI checks changed an admin role and deactivated the account during use, exercised product and category add/edit/delete and Settings with synthetic values, and rejected a stale product price edit after another client changed it. Closing that edit now shows the newer price.
- Pausing the local Firestore Emulator during a product edit left the UI pending and the old price visible; resuming it confirmed the write and displayed the new price, which was also checked in the Emulator. A local proxy then disconnected only the browser client while a second authenticated client changed a product price. After reconnecting, the stale edit failed with a persistent form error, the browser displayed the second client's price, and the Emulator kept that price. The Export download was opened as JSON, and its filename now uses the local date.
- None of these tests touches the production Firestore database.
