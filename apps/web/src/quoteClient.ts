import { quoteResponseSchema, type QuoteRequest, type QuoteResponse } from "@commission-quote/contracts";

export const QUOTE_UNAVAILABLE_MESSAGE = "Quote unavailable. Try again.";

const QUOTE_ENDPOINT = "/graphql";
const MAX_PUBLIC_MESSAGE_LENGTH = 200;

const GENERATE_COMMISSION_QUOTE = `mutation GenerateCommissionQuote($input: QuoteInput!) {
  generateCommissionQuote(input: $input) {
    quoteId
    commissionRate
    totalCommission
  }
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publicMessage(message: string): string {
  if (
    message.length === 0 ||
    message.length > MAX_PUBLIC_MESSAGE_LENGTH ||
    message.includes("\n")
  ) {
    return QUOTE_UNAVAILABLE_MESSAGE;
  }
  return message;
}

export async function generateCommissionQuote(input: QuoteRequest): Promise<QuoteResponse> {
  let response: Response;
  try {
    response = await fetch(QUOTE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: GENERATE_COMMISSION_QUOTE,
        variables: { input },
      }),
    });
  } catch {
    throw new Error(QUOTE_UNAVAILABLE_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(QUOTE_UNAVAILABLE_MESSAGE);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(QUOTE_UNAVAILABLE_MESSAGE);
  }

  if (!isRecord(body)) {
    throw new Error(QUOTE_UNAVAILABLE_MESSAGE);
  }

  const errors = body.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    const message = isRecord(first) && typeof first.message === "string" ? first.message : "";
    throw new Error(publicMessage(message));
  }

  const data = isRecord(body.data) ? body.data.generateCommissionQuote : undefined;
  const parsed = quoteResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(QUOTE_UNAVAILABLE_MESSAGE);
  }
  return parsed.data;
}
