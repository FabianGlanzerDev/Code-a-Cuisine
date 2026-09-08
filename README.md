# Code à Cuisine

Angular application that turns available ingredients and cooking preferences into three recipe suggestions through n8n and Gemini. Recipes are shared through a Firebase Realtime Database cookbook.

## Run locally

Use Node.js compatible with Angular 20: `^20.19.0`, `^22.12.0` or `>=24.0.0`, and npm. This review used Node 24.20.0.

```bash
npm ci
npm start
```

In Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Both environment files currently point to remote n8n and Firebase endpoints. Clicking Generate may invoke a paid model. Automated tests intercept HTTP or use local fixtures and do not generate paid recipes.

## Build and verification

```bash
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
npm run test:backend
npm run n8n:check
npm run check:style
```

Chrome is required for Angular tests. `n8n:build` regenerates the two webhook templates from the validation libraries and prompt. `n8n:check` detects drift between source and checked-in templates.

The production files are generated in `dist/code-a-cuisine/browser`. Publish that directory with SPA fallback to `index.html` for Angular routes. Firebase rules and the separate local emulator test command are documented in [firebase/README.md](firebase/README.md).

## Features and limits

- Positive ingredient quantities in grams, millilitres or pieces; autocomplete, edit and delete.
- 1–12 portions (default 2), 1–3 cooks, three time categories, six cuisines and four diet choices.
- Three suggestions per request. **3 recipes per IP per UTC day; 12 recipes system-wide per UTC day.** One IP can request one batch per day.
- Atomic quota and throttle reservation before the model request, using Firebase ETags. Unconfirmed reservations never start a model request. Reserved slots remain used after model errors to bound costs; no automatic model retry.
- Server checks for positive quantities, canonical IPs, ingredient coverage, diet exclusions, scaled quantities, nutrition and scheduled cooking steps.
- Atomic Firebase saving in n8n with stable keys and up to three storage-only attempts. Pending recipes remain locally available across reloads when browser storage permits. Read-only recovery confirms all three records after backend restoration; no public recipe writes are required.
- Public cookbook, cuisine categories, recipe details, likes and pagination at 20 recipes.

## Backend setup

See [n8n setup](n8n/README.md). The templates contain no credentials. The owner has confirmed connected Firebase OAuth, a successful private quota read and the working `models/gemini-3.6-flash` model, now included in the templates. Trusted ingress, protected recipe writes and the Error Logger integration still need live completion. The repository does not prove that its latest templates are deployed remotely.

## Repository and submission

No Git remote is configured in this checkout; a verified GitHub URL could not be determined. Add the actual repository and deployed frontend links before submission. The existing 41 commits have been preserved. The backend webhook URL is not the frontend submission link.

The complete checklist review, acceptance blockers and changed-file inventory are in [ABNAHME.md](ABNAHME.md). Exclude `node_modules`, `dist` and ignored `tmp` review artifacts from a submission ZIP.
