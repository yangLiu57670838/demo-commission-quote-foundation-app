/** Visible names and text. Steps and page objects do not invent their own selectors. */
export const quoteLocators = {
  heading: "Commission quotes",
  loanAmount: "Loan amount",
  loanTerm: "Loan term in months",
  riskBand: "Risk band",
  generate: "Generate Quote",
  loading: "Generating quote…",
  quoteId: "Quote id",
  commissionRate: "Commission rate",
  totalCommission: "Total commission",
  amountError: "Loan amount must be greater than 0",
  lowBand: "LOW",
} as const;
