# Local Firestore test environment

These tests use only synthetic data and the Firestore Emulator. The runner uses
the `demo-chomdoi-tests` project ID and a separate `firebase.emulator.json` so
it never targets the `chomdoi-house` project. The rules tests also refuse to run
unless `FIRESTORE_EMULATOR_HOST` points to a local address.

## Run

Install Node.js, JDK 21 or newer, and the Firebase CLI, then run:

```sh
npm ci
npm run test:emulator:run
```

On this Mac, JDK 21 is installed through Homebrew but is not the default Java:

```sh
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run test:emulator:run
```

`npm run test:emulator` is the inner test command. Run
`npm run test:emulator:run` to start and stop the emulator automatically.

`firestore.rules.test.js` records the current production rule behavior and its
lost-sale risk. The other tests exercise the proposed staff rules, Firebase Auth
membership checks, confirmed sale writes, and concurrent transactions. The
Auth tests use mocks; Firestore rules and concurrent sales use the Emulator.
No production data or credentials are used.
