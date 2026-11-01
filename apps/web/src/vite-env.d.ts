/// <reference types="vite/client" />

/**
 * Playwright plan. Not wired up yet. Do not add a vendor secret here.
 *
 * Browser automation runs later from `apps/web` (`test:e2e`). It is not part of Jest `pnpm test`.
 * Playwright opens http://localhost:5173. The page calls the BFF only.
 * `VENDOR_API_KEY`, `VENDOR_API_URL`, and `x-simulate` stay on the server.
 * Do not declare them as `VITE_` variables in this file.
 *
 * The server process sets `VENDOR_SIMULATION=forced` for a stable run.
 * Cases: valid quote, field error with no BFF call, loading then result, Tab and Enter, narrow viewport.
 * The screen must not show the api-key, a stack, or the vendor URL.
 */
