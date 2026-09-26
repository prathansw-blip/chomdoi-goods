# Security rollout (deployed; owner confirmed admin webapp access)

Firebase Hosting and `firestore.secure.rules` were deployed on 26 September 2026 at approximately 10:43 Bangkok time from `codex/secure-sync-prep`, application commit `22370b5`. Production is `https://chomdoi-house.web.app`. The deployed client uses Firebase Auth, active staff records and operation-specific transactions; the store no longer contains `users`. The release history was subsequently integrated into `main` by fast-forward. UI/data-handling source and secure Rules match the deployed commit; later commits update documentation, Git housekeeping and build/Node dependencies. The dependency patch described below has not been deployed.

The owner confirmed normal admin access through the deployed webapp on 26 September 2026 at approximately 11:04 Bangkok time. The earlier failed attempt has no confirmed root cause; do not label it a password mismatch or Rules propagation issue. The last observed private diagnostic status had no check result or repair, no password-repair record was found, and its process and browser tab are closed. Codex did not reset a password or deploy a login fix during this investigation. Have each device close old tabs, open the current URL, sign in and check current sales/stock before resuming transactions. Keep Chrome data for the unresolved device reconciliation below. The old public `firestore.rules` remains only for legacy tests and reference.

## Completed cutover and verification

- The owner subsequently checked all devices and confirmed matching stock on 26 September 2026, authorizing continuation. This is owner-reported stock verification, not an audit of historical sales or the old Windows/Android caches. Operational stock verification is complete; preserve browser data for any later record reconciliation. Continue development from `main` and use the Emulator for test transactions.
- The owner confirmed that all devices stopped transacting and explicitly waived the Windows/Android cache audits below.
- A fresh encrypted backup was verified before migration at `/Users/keng/.codex/backups/chomdoi-house/2026-09-26T03-41-30-259Z-e410f9/`. Maintenance deny-all rules were deployed and their published source and anonymous denial were checked before the store write.
- A guarded update removed only `users` and added `revision: 0`, using an update mask and the observed `updateTime` precondition. All other fields compared equal after the write, including LINE Settings. Production retained 14 products and 1,143 transactions. The new store update time was `2026-09-26T03:42:23.647120Z`.
- Hosting HTML and JS/CSS matched local build bytes. Published ruleset `0725e012-e807-4a19-9e7a-6fac61c41aa9` matched `firestore.secure.rules`. An anonymous store read returned 403. Evidence is in `/Users/keng/.codex/backups/chomdoi-house/deployment-verification-1790394194282.json`.
- Existing credentials for `ho`, `jom`, `wan` and `liyah` passed Firebase Auth and authenticated staff/store reads through REST. This does not confirm their browser UI experience. The owner subsequently confirmed normal admin webapp login. No synthetic sales or stock edits were written to Production. Codex did not create/delete Auth accounts or change passwords.
- Post-cutover encrypted backup `/Users/keng/.codex/backups/chomdoi-house/2026-09-26T03-43-14-974Z-dab1f4/` was decrypted and verified, including the migrated store, five staff records, 11 Auth accounts, hash configuration and deployed secure Rules. Keys remain in this Mac's Keychain.

## Preparation checklist (historical; cutover completed)

1. Five approved staff accounts already match existing Firebase Auth accounts; no Auth account was created or changed during preparation. Confirm each employee can sign in through the Chomdoi Goods webapp with their username and password during cutover. Employees do not need Firebase Console access or permission to edit Firebase directly. If a credential needs repair, use an administrator-controlled process. A server backend is optional for provisioning later; no Cloud Functions or Blaze plan is required for the chosen LINE setup. The existing Apps Script proxy receives the token from the browser and does not protect it.
2. Implement and test a client that signs in with Firebase Auth, loads `/staff/{auth.uid}`, rejects absent/inactive staff, and never creates an Auth account during login. All app data loads and writes must wait for that check. Remove the local password/session fallback.
3. The owner approved five legacy-to-Auth matches, and five `/staff/{uid}` records were created and verified in Production on 26 September 2026. The six unmatched Auth accounts have no staff records. Re-check identities, roles and active status before cutover. Keep password fields out of staff documents, localStorage, exports, and HTML. Provision new Auth accounts only through a trusted backend or administrator-controlled process; do not grant unmatched accounts access automatically.
4. Keep the LINE token in `settings.line.channelAccessToken` as requested. The Settings page lets an admin edit it, but Firestore rules grant document-level reads: every active staff account that can read `/stores/chomdoi_main` can also retrieve the token. Hiding Settings from cashiers does not hide this field. The previous public rules may already have exposed the token; rotating it after cutover is recommended. Admin exports of the store also contain it.
5. Review and test every operation-specific transaction before rollout. The candidate writes only changed top-level fields after reading the latest store inside a transaction. Sales, restocks, stock edits, bill cancellation, shifts, settings, and hotel supplies now wait for confirmation before reporting success. A stale edit to the same record fails visibly. Shift deletion also restores stock for its linked sales, which is a deliberate change from the old app.
6. Run the full application against a synthetic Firestore/Auth Emulator dataset, including login, role changes, simultaneous sales, offline/reconnect, and all settings and stock flows.
7. Check every device that has used the old app for unsynced local data. Preserve its browser storage before opening or reloading the old app: an online load can replace the local cache with the Firestore document. Reconcile pending sales and stock changes with Firestore before clearing browser storage or switching the app. The new client intentionally does not load the old local cache. Follow `MIGRATION_PREP.md` and use `scripts/audit-legacy-cache.mjs` only with private files outside the repository.
8. Make a final encrypted backup on this Mac and verify that it can be decrypted. Record the latest document update time and Auth user count before cutover. The owner chose Mac-only storage and accepts that losing the Mac and its Keychain together can make this backup unusable.

## Owner-directed device-audit exception (26 September 2026)

The owner explicitly instructed deployment to proceed without auditing the Windows PC and Android Chrome caches. Only Chrome on this Mac has been audited. Pending sales or stock changes on the other two devices remain unknown and will not automatically sync into the new client later. Preserve their Chrome data; do not clear it or import an old whole-document export. Any later recovery requires a separate comparison and reconciliation against the current server data. This exception removes the device audit as a deployment blocker; the maintenance window, verified final backup, update-time precondition, and deployment checks still apply.

Before clearing a valid legacy cache, the candidate now preserves its business record arrays under `chomdoi_legacy_recovery_<timestamp>` in localStorage. It excludes users and settings, recursively strips credential fields, never imports the copy into live state, and never writes it to Firestore. Existing copies are retained. If storage quota prevents a second copy, it keeps the sanitized records in the original slot. Malformed or inaccessible cache is left untouched and logged without values. This preservation has passed synthetic tests; the actual Windows/Android copies cannot be confirmed until those devices run the new client. These temporary device records are for later reconciliation; the encrypted central backup remains on the Mac.

## Cutover procedure (historical; do not rerun the completed migration)

1. Stop staff transactions and make the final backup.
2. Publish `firestore.maintenance.rules` through `firebase.maintenance.json` so the old public document cannot be read or written during migration. Check the published source before the store write.
3. With administrator credentials, verify the five pre-created staff documents against the owner-approved roster, then remove `users` from the store document. Keep `settings.line` intact, including its token and enabled state. Do not copy plaintext passwords into new documents.
4. Publish the new web app and `firestore.secure.rules` using the branch's `firebase.json`. Verify the published Hosting release and Rules source; unauthenticated and unapproved accounts are denied; approved staff can sign in through the webapp; admins and cashiers see the correct pages. Test simultaneous sales and stock calculations using synthetic Emulator data; do not create test business records in Production.
5. Reopen transactions only after the checks pass. Monitor write failures and Auth denials.

## Rollback principle

If a cutover check fails, keep staff transactions stopped and repair the confirmed cause. Secure rules are currently deployed; maintenance deny-all rules are not currently active. If the failure requires another store migration or exposes data, deploy and verify maintenance rules before that work. Do not restore the old public rules or old browser password flow. Restore the backed-up store only after reconciling transactions created since the backup; a blind whole-document restore would erase newer sales. The encrypted backup and detailed recovery notes are stored outside the repository under `/Users/keng/.codex/backups/chomdoi-house/`, including `ROLLBACK-v2.md`.

## Dependency audit before patch (26 September 2026; historical)

`npm ci` and `npm run build` passed in the primary `main` checkout. Built JS/CSS SHA256 values match the verified deployed assets. `npm audit` reports seven vulnerable packages from the unchanged lockfile:

| Package | Installed | Audit severity | Dependency path |
| --- | --- | --- | --- |
| `@grpc/grpc-js` | `1.9.15` | high | Firebase Firestore Node transport |
| `@protobufjs/utf8` | `1.1.0` | moderate | protobufjs / gRPC Node transport |
| `protobufjs` | `7.5.5` | high | Firestore Node transport |
| `websocket-driver` | `0.7.4` | critical | Firebase Realtime Database Node dependency; this app uses Firestore |
| `vite` | `8.0.10` | high | development/build tooling |
| `postcss` | `8.5.12` | high | development/build tooling |
| `nanoid` | `3.3.11` | high | PostCSS tooling dependency |

A read-only build with output writing disabled inspected 41 bundled module IDs; none of these seven packages appeared in the emitted browser JavaScript module list. This narrows their observed exposure in the current browser build; it does not make the installed Node/development dependencies safe or constitute a complete security audit. The maintainer advisories include [websocket-driver protocol handling](https://github.com/faye/websocket-driver-node/security/advisories/GHSA-xv26-6w52-cph6) and [Vite Windows development server path handling](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff).

No package versions, deployed assets, credentials or Production data were changed during that initial integration check. The subsequent fix and verification follow.

## Dependency security patch (26 September 2026; verified, not deployed)

Started from baseline `6b7d463` on `codex/dependency-security`. Only the dependency manifests and documentation changed; no UI source, input fields, data model, Firestore Rules or Firebase project configuration changed. Firebase `12.12.1`, Chart.js `4.5.1` and the Firebase app/auth/firestore runtime SDK versions stayed unchanged. Vite was pinned to the patched `8.0.16` release; targeted lockfile updates resolved the Node transport vulnerabilities and supporting tooling packages without a forced major upgrade or overrides.

| Audited package | Patched installed version |
| --- | --- |
| `websocket-driver` | `0.7.5` |
| `@grpc/grpc-js` | `1.9.16` |
| `protobufjs` | `7.6.6` |
| `@protobufjs/utf8` | `1.1.2` |
| `vite` | `8.0.16` |
| `postcss` | `8.5.28` |
| `nanoid` | `3.3.19` |

Verification:

- Fresh `npm ci` passed; `npm audit --json` reported 0 vulnerabilities across all severities at the time checked. This is an advisory-based dependency result, not a guarantee that the entire application has no security issues.
- `npm run build` passed. CSS remains `index-BZ0AbyTV.css`; JS is now `index-BH2jw8ZS.js` because the compiler dependency changed. The existing >500 kB chunk warning remains. No layout restructuring or code splitting was included.
- `rtk proxy env PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run test:emulator:run` passed all 45 tests in 10 files, including simultaneous sales, sale/restock/cancellation concurrency, stale-edit rejection, confirmed writes, Rules and legacy-cache preservation.
- UI checks used only the localhost Auth/Firestore Emulators with `demo-chomdoi-tests`: admin and cashier sign-in, expected role menus, opening a shift, recording one sale, preserving Thai text and emoji from the form exactly when read back, restocking three units with a Thai note, and a second browser tab receiving sale/stock changes without reload. Starting stock 20 became 19 after sale and 22 after restock. These were synthetic records, with LINE disabled. No Production credentials or store contents were used.
- The initial anonymous read of the secure Emulator was denied; the input-preservation read then used the synthetic admin's Firebase token and passed. The test tabs and Emulators were shut down after verification. Screenshot evidence: `/Users/keng/.codex/backups/chomdoi-house/dependency-security-2026-09-26-ui.png`.

Production still runs commit `22370b5`. This patch did not read/write Production Firestore, change Auth credentials, send LINE messages or deploy Hosting/Rules. To roll back the dependency change before deployment, revert the patch's manifest/lockfile changes in Git and run `npm ci`; keep the secure client and secure Rules. Do not restore a store snapshot. Any later adoption should use a Hosting-only deployment of the reviewed build; no database migration is required by this patch.

## Preparation and Emulator evidence (before deployment)

- The owner approved five staff roles. Five `/staff/{uid}` records were created atomically in Production and verified by reading them back; six unmatched Auth accounts have no staff record. The store document, Auth accounts, deployed Rules and Hosting were not changed. A post-write encrypted backup including staff was verified on this Mac.
- A sanitized copy of that encrypted backup was restored to a localhost-only Firestore Emulator: 14 products, 1,140 transactions, and five staff records matched. The exact masked write used for store cutover removed `users`, added `revision: 0`, and preserved other fields under an update-time precondition. A local run under secure rules denied an unauthenticated restore request, as expected; the successful drill used a separate local-only open-rules configuration. No Production store write was made.
- The owner identified one Windows PC and one Android phone using Chrome, then explicitly instructed deployment to proceed without their cache audits. Their local-only data is still unverified and does not automatically sync into the new client.
- `tests/firestore.rules.test.js` reproduces unauthenticated access and a lost sale under the legacy rules, which are no longer deployed.
- `tests/firestore.secure.rules.test.js` checks the deployed staff gate and rejects a stale revision.
- `tests/sale.transaction.test.js` verifies two simultaneous sales, sale/restock/cancellation concurrency, stale stock rejection, shift-close protection, settings merge, daily-check conflict, and recovery after an injected `unavailable` write failure using synthetic data. The failure injection is not a real network outage.
- `tests/store.sync.test.js` verifies that changes appear only after a confirmed write and that a failed stock edit does not overwrite a newer remote snapshot.
- The local UI smoke tests signed in as admin and cashier, opened a shift, recorded sales and a restock, and confirmed a second tab received the updated sales and stock. Additional UI checks changed an admin role and deactivated the account during use, exercised product and category add/edit/delete and Settings with synthetic values, and rejected a stale product price edit after another client changed it. Closing that edit now shows the newer price.
- Pausing the local Firestore Emulator during a product edit left the UI pending and the old price visible; resuming it confirmed the write and displayed the new price, which was also checked in the Emulator. A local proxy then disconnected only the browser client while a second authenticated client changed a product price. After reconnecting, the stale edit failed with a persistent form error, the browser displayed the second client's price, and the Emulator kept that price. The Export download was opened as JSON, and its filename now uses the local date.
- None of these Emulator tests touches the production Firestore database. The cutover and read-only deployment verification described above explicitly used Production.
