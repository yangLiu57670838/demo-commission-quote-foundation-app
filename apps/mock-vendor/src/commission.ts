import { quoteResponseSchema, type QuoteRequest, type QuoteResponse, type RiskBand } from "@commission-quote/contracts";
import Decimal from "decimal.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Mock formula only. here assume higher risk band means higher commission rate, but it is possible to change the formula later.
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
    quoteId: uuidv4(),
    commissionRate,
    totalCommission,
  });
}
