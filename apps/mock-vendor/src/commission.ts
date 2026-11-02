import { randomUUID } from "node:crypto";
import { quoteResponseSchema, type QuoteRequest, type QuoteResponse, type RiskBand } from "@commission-quote/contracts";
import Decimal from "decimal.js";

/**
 * Mock formula only. The challenge does not define a rate.
 * Term is validated by the shared schema and does not change the rate.
 */
const MOCK_COMMISSION_RATES: Record<RiskBand, string> = {
  LOW: "0.005",
  MEDIUM: "0.0075",
  HIGH: "0.01",
};

export function quoteCommission(input: QuoteRequest): QuoteResponse {
  const commissionRate = MOCK_COMMISSION_RATES[input.riskBand];
  const totalCommission = new Decimal(input.loanAmount)
    .times(commissionRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);

  return quoteResponseSchema.parse({
    quoteId: randomUUID(),
    commissionRate,
    totalCommission,
  });
}
