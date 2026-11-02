export type VendorSimulate = "success" | "error" | "timeout";

export type BffConfig = {
  vendorApiUrl: string;
  vendorApiKey: string;
  vendorTimeoutMs: number;
  /** `ENABLE_COMMISSION_QUOTE=false` turns quotes off before the vendor is called. */
  quotesEnabled: boolean;
  /** Tests set this so the BFF can force the vendor. It is never taken from the browser. */
  vendorSimulate?: VendorSimulate;
};

export const DEFAULT_VENDOR_TIMEOUT_MS = 2000;

export type BffConfigResult =
  | { ok: true; config: BffConfig }
  | { ok: false; message: string };

const MISSING_VENDOR_ENV = "Missing VENDOR_API_KEY or VENDOR_API_URL";
const INVALID_VENDOR_URL = "VENDOR_API_URL must be an http(s) URL";
const INVALID_TIMEOUT = "VENDOR_TIMEOUT_MS must be a positive whole number";
const INVALID_QUOTE_FLAG = "ENABLE_COMMISSION_QUOTE must be true or false";

export function readBffConfig(env: Record<string, string | undefined>): BffConfigResult {
  const vendorApiKey = env.VENDOR_API_KEY;
  const vendorApiUrlText = env.VENDOR_API_URL;
  if (!vendorApiKey || vendorApiUrlText === undefined || vendorApiUrlText.trim() === "") {
    return { ok: false, message: MISSING_VENDOR_ENV };
  }

  let vendorApiUrl: string;
  try {
    const url = new URL(vendorApiUrlText.trim());
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return { ok: false, message: INVALID_VENDOR_URL };
    }
    vendorApiUrl = url.origin;
  } catch {
    return { ok: false, message: INVALID_VENDOR_URL };
  }

  const vendorTimeoutMs = readTimeout(env.VENDOR_TIMEOUT_MS);
  if (vendorTimeoutMs === undefined) {
    return { ok: false, message: INVALID_TIMEOUT };
  }

  const quotesEnabled = readQuotesEnabled(env.ENABLE_COMMISSION_QUOTE);
  if (quotesEnabled === undefined) {
    return { ok: false, message: INVALID_QUOTE_FLAG };
  }

  return {
    ok: true,
    config: {
      vendorApiKey,
      vendorApiUrl,
      vendorTimeoutMs,
      quotesEnabled,
    },
  };
}

function readQuotesEnabled(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === "") {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

function readTimeout(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_VENDOR_TIMEOUT_MS;
  }
  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}
