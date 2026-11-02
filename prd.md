# Commission Quote App — Plan

Goal: a working web app and a separate mock vendor. Staff enter loan details and see a commission quote. The real vendor does not exist yet. This app is the base we will extend in the live pairing session.

The challenge requires the form, the quote result, loading and error states, the vendor contract, an `api-key`, random vendor failures, a few tests, run steps, and a short note on how AI was used. It does not require GraphQL, Docker, a commission formula, feature flags, or a log library. Those are our choices. Say that clearly in the README and in the interview.

## 1. Must ship

- Form fields: `loanAmount`, `loanTermInMonths`, `riskBand` (`LOW`, `MEDIUM`, `HIGH`).
- A **Generate Quote** button.
- While waiting, show a loading state. On success, show `quoteId`, `commissionRate`, and `totalCommission`.
- Reject bad input with a clear message. Cover empty, zero, negative, not a number, and a term that is not a whole number.
- Mock vendor accepts those three fields and returns those three quote fields. Extra fields are fine. The app must not depend on them.
- Mock vendor rejects a missing or wrong `api-key`.
- Mock vendor fails at random in normal mode. Test mode can force success or failure so tests stay stable.
- The browser never sees the vendor key or the vendor URL. A small server in the middle (the BFF) calls the vendor, sets a timeout, and turns vendor failures into a safe message.
- Core tests, a way to start the app, and a README that includes AI use.

The challenge does not give a commission formula. The mock uses one simple, fixed formula and documents it. When the real vendor arrives, we delete that formula and trust the vendor’s numbers.

## 2. How a request works

```
Browser (React)
  -> BFF (GraphQL mutation)
       -> check the feature is on
       -> check the input
       -> call the vendor with api-key and a request id
            -> Mock vendor (HTTP)
                 -> check the key and the input
                 -> sometimes wait or fail
                 -> return the quote
```

GraphQL is only the door between the browser and our server. The vendor stays plain HTTP, matching the agreed contract. We can swap GraphQL for a single REST call if time runs short. The vendor boundary should not change.

## 3. Tech choices

| Choice | Why | If we skip it |
| --- | --- | --- |
| React + TypeScript | Clear types, easy form tests | Plain JavaScript still works |
| Vite | Fast local start | — |
| Apollo Client + Apollo Server | Typed mutation, built-in loading and error state | One `fetch` call is enough for a single action |
| Express mock vendor | Real HTTP, real headers, real status codes | A fake in-process function would hide auth and network bugs |
| Zod | Checks data at the server and vendor. TypeScript does not check HTTP bodies | Hand-written checks |
| decimal.js | Money math without binary float errors | Only if we show rounding in the interview |
| Jest + React Testing Library | Unit and UI tests, one `pnpm test` | — |
| Supertest | Integration tests call the BFF over HTTP. Separate command: `pnpm test:integration` | A hand-written `fetch` |
| Pino | JSON logs, hide the API key | `console` is enough for the timebox |
| Env feature flag | Turn quotes off without a deploy platform | Skip if time is gone |
| Docker Compose | One command to start web, BFF, and vendor | `npm` scripts must still work |

## 4. Edge cases

Handle these in the 4 hours:

- Empty fields, spaces only, and the wrong type (text in an amount box).
- Zero, negative, `NaN`, `Infinity`, and a term like `12.5`.
- Very large amounts. Do not let the page show `Infinity` or lose cents.
- `riskBand` must be exactly `LOW`, `MEDIUM`, or `HIGH`. Reject other case and unknown values.
- Extra JSON fields are ignored. Missing quote fields from the vendor are an error, not a blank success.
- User double-clicks **Generate Quote**. Disable the button while the request is in flight.
- Vendor returns 401, 400, 500, invalid JSON, or no response before the timeout. The user sees a short message. The page does not show the API key, stack traces, or vendor URL.
- Vendor is slow. The BFF gives up after a fixed timeout and shows an error.

Leave these for later, but know them:

- Two identical requests should not create two different business quotes once a real vendor can bill or store them. Today the mock can return a new id each time.
- What is the max loan amount and max term? The challenge does not say. Pick sane demo limits and write them down.
- Currency. Assume a single currency until the contract says otherwise.

## 5. Tests

We do not need 100% coverage. Test the paths that can lose money, leak the key, or confuse the user.

### Unit

- Validation: each bad input above, plus one valid example.
- Commission math: known inputs, rounding, and a large amount.
- Error mapping: timeout, 401, 500, and bad JSON become safe messages.
- Vendor key check: missing, wrong, and correct.
- Logs and error bodies do not contain the API key.

### Integration

Run with `pnpm test:integration`. The tests live in `apps/bff/integration` and are not part of `pnpm test`. Supertest calls the BFF. The BFF calls the mock vendor. Force success or failure so random faults do not flake the suite.

- Happy path: valid input returns the three quote fields.
- Wrong or missing `api-key` is rejected and the browser never needed the key.
- Forced vendor error and forced timeout show an error state, not a quote.
- Vendor body that fails the contract does not render as success.
- Feature flag off: request is rejected before the vendor is called.

### UI

- Valid submit shows the quote.
- Invalid submit shows a field message and does not call the server.
- Loading appears, then the result replaces it.
- Keyboard-only: tab to the fields and submit with Enter.

### Load

Not part of the 4-hour must-ship. Add a small script later (k6 or autocannon) against the BFF with failure injection **off**, so random vendor errors are not mistaken for capacity problems.

First target for a staff tool, not a public site: 50 users at once, most requests under a few seconds, no crash, no leaked key in errors. Watch for timeout piles and retries that hammer the vendor. Do not add retries until the vendor agrees that a repeat call is safe.

Later scale path: more than one BFF instance, a limit on calls to the vendor, and no shared in-memory quote store unless we add a real database.

## 6. Accessibility and mobile

Do the cheap basics in the 4 hours. A full audit can wait.

- Every input has a visible label. The button has a clear name.
- Errors sit next to the field and are announced (use `aria-invalid` and `aria-describedby`, or a live region for the result).
- Focus moves in a sensible order. The loading state is visible and not only a colour change.
- Text and buttons meet basic contrast. Touch targets stay easy to tap.
- On a narrow phone, the form stacks in one column, text does not overflow sideways, and the quote is still readable.

Later: keyboard focus rings, reduced motion, screen reader pass, and a check against WCAG 2.2 AA.

## 7. Security

This is staff lending data. Treat the loan and the quote as confidential. There is no card data here, so card-industry rules (PCI) are not the driver. Bank rules still are: know who called, protect secrets, and do not leak data in errors or logs.

### In this foundation

- Vendor `api-key` lives only in server env, never in React, never in git, never in logs.
- Validate input on the server even if the form already checked it.
- Timeout every vendor call. Map failures to a generic user message.
- Return the right status (401 for a bad key, 400 for bad input). Do not reflect raw vendor bodies to the browser.
- Depend on a lockfile. Do not invent a vendor URL from user input.

### Bank level, after this app

- Staff sign-in (SSO) and a role check. Only lending staff can generate quotes.
- Audit log: who asked, when, and which `quoteId` came back. Do not store more customer data than we need.
- TLS everywhere. Keys in a secret store, with rotation. Separate keys per environment.
- Rate limits on the BFF and respect the vendor’s limits.
- Security headers, dependency and secret scans in CI, and a review before production.
- Pen test and a clear owner for incidents.

## 8. Risks

- The 4-hour clock. GraphQL, Docker, and structured logs are optional. Cut them before cutting validation, the key boundary, or tests.
- The formula is a guess. Label it as mock-only so nobody treats demo numbers as a real commission.
- Random failures make tests flake if test mode is not wired through.
- Float math can round money wrong. Use a decimal type in the mock formula.
- The mock can drift from the real vendor. Keep the contract in one shared schema and change it in one place.
- A key in the frontend bundle or in a log line is a failed review even if the demo works.
- No staff login yet. Fine for the exercise. Not fine for a real bank environment.

## 9. Nice to have (only if the must-ship works)

- GraphQL between browser and BFF.
- Docker Compose.
- An env flag to turn quotes off.
- JSON logs with a request id, and the API key redacted.
- The basic accessibility and mobile items above, if they did not fit the first pass.
- A short load script with failures turned off.
- Playwright browser tests in `apps/web` (`test:e2e`), after the must-ship works. Not part of `pnpm test`. Jest keeps the unit and integration tests. Start the web app, the BFF, and the mock vendor, then open `http://localhost:5173`. The page calls the BFF only. Set `VENDOR_SIMULATION=forced` on the server. Do not put the vendor key, the vendor URL, or `x-simulate` in the page or in a `VITE_` variable. Cover a valid quote, a field error that does not call the BFF, loading then the result, Tab and Enter, and a narrow viewport. The screen never shows the `api-key`, a stack, or the vendor URL.

## 10. After this foundation

Order matters. Do not start at the bottom.

1. Swap the mock call for the real vendor behind the same client interface. Keep the mock for local dev and tests.
2. Add staff login, roles, and an audit record of each quote.
3. Agree retries with the vendor. Only then add retry, a circuit breaker, and idempotency.
4. Add CI (test, lint, secret scan) and dashboards for latency, errors, and vendor timeouts.
5. Persist quotes only if the business needs history. Until then, do not add a database for show.
6. Run the load script, then set vendor limits and BFF timeouts from real numbers.

Still out of scope until a real production design exists: Kubernetes, Terraform, a message queue, and a distributed tracing product.
