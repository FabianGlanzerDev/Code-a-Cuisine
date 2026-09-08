# n8n setup — Code à Cuisine

The three `.workflow.json` files are credential-free local import templates. They have not been compared with a live n8n instance. Their presence does not prove deployment or successful production execution.

Owner-confirmed setup (08 September 2026): Firebase OAuth is connected; authenticated GET `/privateQuota/v2/state.json` returns 200 with `null`, while public access is denied. The Generate Recipe workflow is imported with credentials assigned. The working model is `models/gemini-3.6-flash`, now included locally. Both supported IP headers arrive, but neither has a confirmed trust boundary; `trustedIpHeader` intentionally remains empty. `/recipes` is still publicly writable and must be restricted with the coordinated rules/frontend change below.

## Required configuration before activation

1. Import `error-handler.workflow.json`. Create an error-log Data Table with string columns `logKey`, `timestamp`, `workflow`, `execution`, `message`; select its real ID in `Store Error Log` (currently `SET_ERROR_LOG_TABLE_ID`).
2. Import the two webhook workflows. In each workflow's settings, select the imported Error Logger. Replace `SET_ERROR_WORKFLOW_ID` with its real workflow ID. Trigger a controlled infrastructure error in an isolated test workflow to verify logging; manual editor runs do not prove production error-trigger wiring.
3. In both `Backend Configuration` nodes, set `trustedIpHeader` only after confirming that the ingress proxy overwrites the header and the origin cannot be reached while bypassing it. Supported single-address headers: `cf-connecting-ip` or `x-real-ip`. Missing configuration fails closed. Caller-provided `X-Forwarded-For` chains are not trusted. Verify the actual n8n Cloud/proxy configuration instead of assuming a header is trustworthy.
4. Preserve the confirmed `models/gemini-3.6-flash` model and existing Google Gemini(PaLM) API credential. The direct HTTP request uses one candidate and bounded output without automatic model retries.
5. Preserve the connected **Google Firebase Realtime Database OAuth2 API** credential in every quota HTTP node and in `Store Recipes Atomically`; assign it to the Quota Status workflow if not yet imported. Keep credentials in n8n, never in JSON or Angular environments. Apply the latest storage settings: `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 1000` on **Store Recipes Atomically only**; save failed execution data (`saveDataErrorExecution: all`) for recovery. Do not create competing copies of the production webhook workflows.
6. Keep `/privateQuota` private. The confirmed authenticated read is complete; the ETag GET and conditional PUT still need a write-capable OAuth integration test in a separate test database. No permissive ancestor may grant access.
7. Apply [the tested Firebase rules](../firebase/database.rules.json) together with the updated frontend. Public recipe contents must not be writable; only constrained likes remain writable. Public reads and the `cuisine` index remain enabled. Verify browser CORS exposes `ETag` and permits `if-match`. See [storage, recovery and rules tests](../firebase/README.md). Live rules were not changed by this review.

Email remains disabled. Configure real SMTP, sender and recipient values before enabling it; email is optional when table logging works. The logger stores a sanitized message and workflow/execution identity, not raw prompts, headers, URLs containing keys or model responses.

## Atomic recipe quota and throttle

The previous Data Table read/upsert sequence was not safe under concurrency. Both webhooks now share one private Firebase state at `/privateQuota/v2/state`:

```text
days[YYYY-MM-DD].used             reserved recipe slots system-wide
days[YYYY-MM-DD].ips[canonicalIP]  reserved recipe slots for that IP
lastRequests[canonicalIP]         last reservation time in milliseconds
```

IPv4 uses canonical dotted decimal; IPv6 uses eight lowercase groups. IPv4-mapped IPv6 shares the IPv4 identity. Dots and colons become underscores in Firebase keys. Invalid/missing IPs are rejected instead of grouped under `unknown`.

A GET obtains the complete state and ETag. The proposal adds **3** to both counters and updates the rate timestamp. A conditional PUT with `if-match` commits all three together. Only HTTP 200 enables generation. HTTP 412 returns a retryable 429 without starting the model. Timeouts and other failures stop the model path. Independent IPs racing for the last system slots cannot exceed 12.

The 10-second rate window persists across midnight. Daily quota uses UTC, stated in the UI. Existing days are preserved; no production history or recipes are deleted. Reservations remain consumed on model errors or invalid output, preventing repeated paid failures from bypassing the cost limit. Quotas therefore describe reserved recipe slots; failed requests may reduce delivered recipes that day. The UI explains this behavior.

**Migration:** never run old and new quota implementations simultaneously. Switch after a UTC reset with old executions drained, or migrate the current day's recipe usage and rate timestamps first. Old counters counted generations: 1 represents 3 recipes. Do not initialize a fresh quota store mid-day while leaving existing usage unaccounted for. No migration or deployment was executed during this review.

The mechanism follows Firebase's [conditional REST writes](https://firebase.google.com/docs/database/rest/save-data). n8n's [HTTP Request node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest) supports predefined credentials and complete response metadata. Model requests follow Google's [generateContent API](https://ai.google.dev/api/generate-content).

## Request, output and persistence contract

Requests follow `RecipeRequirements` in `src/app/models/recipe.model.ts`. Quantities must be positive finite decimals up to 10000, using `g`, `ml` or pieces (empty suffix). Names must be distinct, with 1–30 ingredients. Portions are integers 1–12, cooks integers 1–3. The backend independently checks all choices.

The prompt is maintained in `prompts/recipes.txt`. Generated ingredients also include `perPortionServingSize`. The backend verifies `servingSize = perPortionServingSize × portionsAmount`, enforces available quantities and returns computed totals. Every recipe needs at least 70% of distinct supplied names and at most three missing pantry basics. Known meat/fish/dairy exclusions are checked; keto is defined as at most 10% carbohydrate energy. Conservative word lists are not a comprehensive food ontology. Real output still needs semantic review.

Directions include `startMinute`, `durationMinutes`, `dependsOn`, consecutive `order`, integer `cook` and an accurate `parallel` flag. Dependencies finish before successors, every cook gets work without overlapping tasks, and the schedule fits the cooking time. Structural checks cannot prove that every natural-language cooking instruction is sensible.

Nutrition requires kcal, macro grams and calorie-share percentages, including totals proportional to portions. Recipes must differ in preparation text and title. Incomplete or truncated responses return an error and reach the logger.

n8n assigns stable execution-based IDs and saves all three recipes in one atomic multipath PATCH before returning `persisted: true`. Browser disconnects do not prevent backend storage. Only this storage request is retried, at most three times, without resetting likes. If all attempts fail, the workflow returns recipes with the same IDs and `persisted: false`, then triggers the error logger. Angular retains the pending batch and **Check saved recipes** reads those IDs to confirm all immutable contents. Missing/partial records or denied reads keep the batch pending; there is no public PATCH fallback and no further Gemini request. If browser storage also fails, keep the tab open. For persistent failures, restore the original `Prepare Recipe Storage.updates` payload through authenticated storage only, using retained failed execution data. Never rerun the model, reservation, or complete failed workflow for storage recovery.

## Maintain and verify

```bash
npm run n8n:build
npm run n8n:check
npm run test:backend
```

The builder regenerates webhook templates from `lib/*.cjs`; it does not export deployed workflows. It retains the owner-confirmed model but leaves the unverified IP header and real workflow/table IDs unconfigured. Preserve actual deployment configuration in n8n and obtain fresh credential-free exports after integration testing for submission. Local backend tests execute embedded Code nodes and graph references; the separate `test:rules` suite exercises actual Firebase emulator rules and conditional REST transactions. Neither runs the n8n engine or verifies production OAuth permissions.
