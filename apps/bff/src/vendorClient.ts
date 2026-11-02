import { quoteResponseSchema, type QuoteRequest, type QuoteResponse } from "@commission-quote/contracts";
import type { BffConfig } from "./config";

export const QUOTE_UNAVAILABLE_MESSAGE = "Quote unavailable. Try again.";
export const QUOTE_TIMEOUT_MESSAGE = "The quote service took too long. Try again.";

const QUOTE_PATH = "/commission-quotes";

export class VendorCallError extends Error {
  readonly kind: "timeout" | "unavailable";

  constructor(kind: "timeout" | "unavailable") {
    super(kind === "timeout" ? QUOTE_TIMEOUT_MESSAGE : QUOTE_UNAVAILABLE_MESSAGE);
    this.name = "VendorCallError";
    this.kind = kind;
  }
}

export function publicErrorMessage(
  message: string,
  config: Pick<BffConfig, "vendorApiKey" | "vendorApiUrl">,
): string {
  const mentionsKey = config.vendorApiKey.length > 0 && message.includes(config.vendorApiKey);
  const mentionsUrl = config.vendorApiUrl.length > 0 && message.includes(config.vendorApiUrl);
  if (
    message.length === 0 ||
    mentionsKey ||
    mentionsUrl ||
    message.includes("\n") ||
    message.includes("node_modules")
  ) {
    return QUOTE_UNAVAILABLE_MESSAGE;
  }
  return message;
}

function commissionQuoteUrl(vendorApiUrl: string): string {
  const url = new URL(vendorApiUrl);
  url.pathname = QUOTE_PATH;
  url.search = "";
  url.hash = "";
  return url.href;
}

function isTimeout(error: unknown): boolean {
  if (hasTimeoutName(error)) {
    return true;
  }
  if (typeof error === "object" && error !== null && "cause" in error) {
    return hasTimeoutName(error.cause);
  }
  return false;
}

function hasTimeoutName(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError";
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The status is enough. The body is never shown to the browser.
  }
}

export async function requestCommissionQuote(
  config: BffConfig,
  input: QuoteRequest,
  requestId: string,
): Promise<QuoteResponse> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "api-key": config.vendorApiKey,
    "x-request-id": requestId,
  };
  if (config.vendorSimulate !== undefined) {
    headers["x-simulate"] = config.vendorSimulate;
  }

  let response: Response;
  try {
    response = await fetch(commissionQuoteUrl(config.vendorApiUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      redirect: "error",
      signal: AbortSignal.timeout(config.vendorTimeoutMs),
    });
  } catch (error) {
    throw new VendorCallError(isTimeout(error) ? "timeout" : "unavailable");
  }

  if (!response.ok) {
    await discardBody(response);
    throw new VendorCallError("unavailable");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new VendorCallError("unavailable");
  }

  const parsed = quoteResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new VendorCallError("unavailable");
  }
  return parsed.data;
}
