export const QUOTES_DISABLED_MESSAGE = "Commission quotes are turned off.";

export type QuoteOutcome = "disabled" | "invalid" | "quoted" | "failed";

export type QuoteLog = {
  requestId: string;
  outcome: QuoteOutcome;
};

const REDACTED = "[redacted]";

/** One JSON line. The loan body is not a field. Secret text is replaced. */
export function quoteLogLine(event: QuoteLog, secrets: readonly string[]): string {
  let line = JSON.stringify({
    requestId: event.requestId,
    outcome: event.outcome,
  });
  for (const secret of secrets) {
    if (secret.length === 0) {
      continue;
    }
    line = line.split(secret).join(REDACTED);
  }
  return line;
}

export function logQuote(event: QuoteLog, secrets: readonly string[]): void {
  console.log(quoteLogLine(event, secrets));
}
