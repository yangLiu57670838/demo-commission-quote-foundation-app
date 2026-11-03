export const QUOTES_DISABLED_MESSAGE = "Commission quotes are turned off.";

export type QuoteOutcome = "received" | "disabled" | "invalid" | "vendor" | "quoted" | "failed";

export type QuoteLogLevel = "info" | "warn" | "error";

export type QuoteLog = {
  level: QuoteLogLevel;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  outcome: QuoteOutcome;
  quoteId?: string;
  reason?: string;
};

const REDACTED = "[redacted]";

/** One JSON line. The loan body is not a field. Secret text is replaced. */
export function quoteLogLine(event: QuoteLog, secrets: readonly string[]): string {
  const fields: Record<string, string> = {
    level: event.level,
    traceId: event.traceId,
    spanId: event.spanId,
    outcome: event.outcome,
  };
  if (event.parentSpanId !== undefined && event.parentSpanId.length > 0) {
    fields.parentSpanId = event.parentSpanId;
  }
  if (event.quoteId !== undefined && event.quoteId.length > 0) {
    fields.quoteId = event.quoteId;
  }
  if (event.reason !== undefined && event.reason.length > 0) {
    fields.reason = event.reason;
  }
  let line = JSON.stringify(fields);
  // just in case the api key or vendor url is logged
  for (const secret of secrets) {
    if (secret.length === 0) {
      continue;
    }
    line = line.split(secret).join(REDACTED);
  }
  return line;
}

export function logQuote(event: QuoteLog, secrets: readonly string[]): void {
  const line = quoteLogLine(event, secrets);
  if (event.level === "error") {
    console.error(line);
    return;
  }
  if (event.level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}
