# Commission Quote

Staff enter loan details and see a commission quote. The real vendor does not exist yet. This repo runs a React page, a BFF, and a mock vendor so the form, the key boundary, and the failure states can be tried locally.

The page calls the BFF with one GraphQL mutation. GraphQL is our choice. The challenge does not require it. The vendor stays plain HTTP.

## Install

Use Node.js 22 or newer and pnpm 10 (`packageManager` in the root `package.json`).

```bash
pnpm install
```

## Environment

`pnpm dev` reads `.env.local`. That file is already in the repo. It holds a demo placeholder key, not a real vendor key. Do not replace it with a real key and commit that.

`.env.dev` is the file named by `docker-compose.yml`. It uses the Compose service hostnames. Local `pnpm dev` does not read it.

| Name | Role |
| --- | --- |
| `VENDOR_API_URL` | Vendor origin. Local value: `http://localhost:4001`. The BFF reads this. The browser never does. |
| `VENDOR_API_KEY` | Sent by the BFF as the `api-key` header. Server env only. |
| `VENDOR_TIMEOUT_MS` | How long the BFF waits for the vendor. `2000` if unset. |
| `VENDOR_FAILURE_RATE` | Chance the mock fails a quote, from `0` to `1`. `0.2` if unset (about one call in five). |
| `BFF_URL` | Where the Vite dev server proxies `/graphql`. `http://localhost:4000` if unset. |

`ENABLE_COMMISSION_QUOTE` is in the env files for a later kill switch. The running app does not read it.

The browser calls `/graphql` on the Vite server. Vite proxies that to the BFF. The page has no vendor URL and no `api-key`.

## Start

```bash
pnpm dev
```

- Web: http://localhost:5173
- BFF GraphQL: http://localhost:4000/graphql
- Mock vendor health: http://localhost:4001/health

If port 5173 is already taken, Vite prints the next port. Open that URL.

On the page, enter a loan amount, a whole number of months, and a risk band (`LOW`, `MEDIUM`, or `HIGH`). Press **Generate Quote**. The button stays disabled until the quote or a short error replaces the loading text.

Example: amount `10000`, term `12`, band `LOW` returns commission rate `0.005` and total commission `50.00`. The quote id is new each time.

## Test

```bash
pnpm test
pnpm lint
pnpm typecheck
```

## Mock formula and demo limits

The challenge does not define a commission formula or a maximum loan. The numbers below are demo assumptions. When a real vendor arrives, delete the formula and trust the vendor's quote.

Commission rate by risk band: `LOW` is `0.005`, `MEDIUM` is `0.0075`, `HIGH` is `0.01`. Total commission is the loan amount times that rate, rounded half up to 2 decimals. The term is checked and does not change the rate. This demo assumes a higher band means a higher rate. A real vendor may use one rate for every band.

Until a real contract says otherwise, the app assumes one currency, a maximum loan amount of `10000000`, and a maximum term of `360` months. `360` is a 30-year demo cap, not a vendor rule. The commission rate is at most `1`, and the total commission cannot exceed `10000000`.

The same loan details can return a new `quoteId`. Do not retry a vendor call until the vendor agrees a repeat is safe.

## Force a vendor error

With `VENDOR_FAILURE_RATE=0.2`, some quotes fail on their own. The page then says `Quote unavailable. Try again.`

To force that error every time, set `VENDOR_FAILURE_RATE=1` in `.env.local` and restart `pnpm dev`. Generate a quote. Set the rate back to `0.2` afterwards. `0` makes the mock succeed on every call, which is useful when a random failure would hide a different bug.

`VENDOR_SIMULATION=forced` is for the Jest tests. In that mode the mock honors an `x-simulate` header of `success`, `error`, or `timeout` from the BFF. The browser never sends that header, and `pnpm dev` does not turn the env var into one. Leave `VENDOR_SIMULATION` out of `.env.local`.

## Later

- Staff login and a role check, so only lending staff can generate quotes.
- An audit log of who asked, when, and which `quoteId` came back.
- The real vendor behind the same BFF client. Keep the mock for local dev and tests.
- Retries, only after the vendor says a repeat call is safe. Until then the mock can mint a new `quoteId` for the same loan.

## AI

A person drove the architecture: a React page, a BFF, and a mock vendor, with the vendor key staying on the server. Cursor's AI then built the app step by step from that plan (vibe coding). A person reviewed and polished the result, and checked the form by hand: amount `10000` at `LOW` returned rate `0.005` and total `50.00`, amount `0` stayed on the page, and a forced vendor failure showed `Quote unavailable. Try again.`.