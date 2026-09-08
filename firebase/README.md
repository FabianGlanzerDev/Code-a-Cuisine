# Firebase rules and storage

`database.rules.json` is the complete ruleset for this application's two database branches. It was tested with Firebase Realtime Database Emulator 4.11.2. It has **not** been published to production.

## Required production change

Keep a copy of the existing rules. Publish this ruleset through Firebase Console → Realtime Database → Rules, together with the updated frontend and n8n storage settings. If this database also serves other applications, preserve their separate required rules without granting access on the root. Updating rules does not delete database contents.

| Operation | Result |
|---|---|
| Public reads under `/recipes`, including cuisine queries | Allowed; `cuisine` is indexed |
| Public creation, changes to recipe contents, deletion | Denied, including multipath PATCH |
| Anonymous `/recipes/$id/likes` update | Integer ±1, never negative, only on an existing recipe; omitted initial counter can become 1 |
| Public access to `/privateQuota` or database root | Denied |
| n8n recipe PATCH and quota conditional PUT | Require the existing privileged Firebase OAuth credential |

An ancestor `.write: true` would also grant writes to recipe contents and private quotas. Do not keep a permissive root or `/recipes` write rule. Firebase documents [rule inheritance](https://firebase.google.com/docs/database/security/core-syntax) and [server authentication with Google OAuth2](https://firebase.google.com/docs/database/rest/auth).

The owner's authenticated quota GET (200 with `null`) and denied public GET are confirmed setup evidence. They do not establish OAuth **write** permissions, conditional writes, or browser CORS. Verify those in a separate test database using the deployed n8n nodes before switching production rules.

## Saving, fallback and likes

n8n saves the already validated batch atomically and retries **only this PATCH**, at most three times, with unchanged execution IDs and without touching likes. No quota or model request is retried automatically. Successful storage returns `persisted: true`.

If all storage attempts fail, `persisted: false` carries the original IDs to Angular and the execution reaches the Error Logger. Angular retains the batch locally and reads each of those IDs. It accepts recovery only when all immutable contents match; it tolerates Firebase's omission of empty arrays and ignores changed likes. Missing or partial records and denied reads leave the batch pending. **Check saved recipes** repeats reads only; it does not generate or write. Public write permission must never be reopened to make fallback work.

When storage remains incomplete, the site owner must repair the backend/storage problem and replay the saved `Prepare Recipe Storage.updates` payload through the authenticated **Store Recipes Atomically** node only. Retain the original IDs; do not rerun generation, reservation, or the whole workflow. Failed execution data is explicitly retained for this recovery and must remain restricted to the operator. The generic Error Logger entry identifies that execution. Angular can confirm the recovered batch afterward. If local storage is blocked, keep the tab open.

Likes use public ETag GET and conditional PUT on the counter child only. Emulator tests verify real 412 conflicts and successful retries. This is an anonymous shared counter, not a verified one-person-one-vote system.

## Repeat local rule tests

With Java 21+ and Firebase CLI available, start an isolated demo emulator in one terminal:

```bash
cd firebase
firebase emulators:start --only database --project demo-code-a-cuisine
```

In a second terminal, from the repository root:

```bash
npm run test:rules
```

The tests use only `127.0.0.1:9000` and fresh `demo-cuisine-*` namespaces. The reserved emulator owner token is used solely for test seeding; it is not a production credential. Tests load the actual rules and exported storage Code node. They check protected paths, public cookbook queries, complete server batches, denied public writes/deletion, atomic rejection, first likes/unlikes, stable storage retries, concurrent ETag likes, and the 3/12 recipe limits with real conditional quota requests. No Gemini requests or production data are involved. Emulator success does not verify the live OAuth account or n8n engine.
