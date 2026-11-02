import {
  DEMO_MAX_LOAN_AMOUNT,
  DEMO_MAX_LOAN_TERM_MONTHS,
  quoteRequestSchema,
  quoteResponseSchema,
} from "./index";

const validRequest = {
  loanAmount: "25000.50",
  loanTermInMonths: 36,
  riskBand: "MEDIUM",
};

describe("quoteRequestSchema", () => {
  it("accepts one valid body", () => {
    expect(quoteRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it("keeps a trimmed amount as a decimal string", () => {
    expect(quoteRequestSchema.parse({ ...validRequest, loanAmount: "  25000.50  " })).toEqual(
      validRequest,
    );
  });

  it("ignores extra fields", () => {
    expect(quoteRequestSchema.parse({ ...validRequest, note: "ignore me" })).toEqual(validRequest);
  });

  it("accepts the maximum amount and term", () => {
    expect(
      quoteRequestSchema.parse({
        loanAmount: DEMO_MAX_LOAN_AMOUNT,
        loanTermInMonths: DEMO_MAX_LOAN_TERM_MONTHS,
        riskBand: "LOW",
      }),
    ).toEqual({
      loanAmount: DEMO_MAX_LOAN_AMOUNT,
      loanTermInMonths: DEMO_MAX_LOAN_TERM_MONTHS,
      riskBand: "LOW",
    });
  });

  it.each([
    ["empty", {}],
    ["empty amount", { ...validRequest, loanAmount: "" }],
    ["spaces only", { ...validRequest, loanAmount: "   " }],
    ["zero", { ...validRequest, loanAmount: "0" }],
    ["zero decimals", { ...validRequest, loanAmount: "0.00" }],
    ["negative", { ...validRequest, loanAmount: "-1" }],
    ["NaN string", { ...validRequest, loanAmount: "NaN" }],
    ["NaN", { ...validRequest, loanAmount: Number.NaN }],
    ["Infinity string", { ...validRequest, loanAmount: "Infinity" }],
    ["Infinity", { ...validRequest, loanAmount: Number.POSITIVE_INFINITY }],
    ["numeric amount", { ...validRequest, loanAmount: 25000.5 }],
    ["term 12.5", { ...validRequest, loanTermInMonths: 12.5 }],
    ["term string 12.5", { ...validRequest, loanTermInMonths: "12.5" }],
    [
      "term fraction that would round to a whole number",
      { ...validRequest, loanTermInMonths: "360.00000000000001" },
    ],
    ["term zero", { ...validRequest, loanTermInMonths: 0 }],
    ["term negative", { ...validRequest, loanTermInMonths: -3 }],
    ["empty term", { ...validRequest, loanTermInMonths: "" }],
    ["spaces only term", { ...validRequest, loanTermInMonths: "   " }],
    ["term NaN", { ...validRequest, loanTermInMonths: Number.NaN }],
    ["wrong band", { ...validRequest, riskBand: "high" }],
    ["unknown band", { ...validRequest, riskBand: "CRITICAL" }],
    ["amount above the demo max", { ...validRequest, loanAmount: "10000000.01" }],
    ["term above the demo max", { ...validRequest, loanTermInMonths: DEMO_MAX_LOAN_TERM_MONTHS + 1 }],
  ])("rejects %s", (_name, body) => {
    expect(quoteRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("quoteResponseSchema", () => {
  const validResponse = {
    quoteId: "quote-1",
    commissionRate: "0.0075",
    totalCommission: "187.50",
  };

  it("accepts one valid quote", () => {
    expect(quoteResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it.each([
    ["empty quote id", { ...validResponse, quoteId: "   " }],
    ["numeric rate", { ...validResponse, commissionRate: 0.0075 }],
    ["NaN commission", { ...validResponse, totalCommission: "NaN" }],
    ["missing total commission", { quoteId: "quote-1", commissionRate: "0.0075" }],
  ])("rejects %s", (_name, body) => {
    expect(quoteResponseSchema.safeParse(body).success).toBe(false);
  });
});
