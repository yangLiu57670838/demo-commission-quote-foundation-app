import { quoteCommission } from "./commission";

const term = 12;

describe("quoteCommission", () => {
  it("prices a known low-risk loan at half a percent", () => {
    const quote = quoteCommission({
      loanAmount: "10000",
      loanTermInMonths: term,
      riskBand: "LOW",
    });

    expect(quote.commissionRate).toBe("0.005");
    expect(quote.totalCommission).toBe("50.00");
    expect(quote.quoteId.length).toBeGreaterThan(0);
  });

  it("rounds half up to cents", () => {
    const quote = quoteCommission({
      loanAmount: "1",
      loanTermInMonths: term,
      riskBand: "LOW",
    });

    expect(quote.totalCommission).toBe("0.01");
  });

  it("rounds a fraction under half a cent down", () => {
    const quote = quoteCommission({
      loanAmount: "10.10",
      loanTermInMonths: term,
      riskBand: "HIGH",
    });

    expect(quote.commissionRate).toBe("0.01");
    expect(quote.totalCommission).toBe("0.10");
  });

  it("prices a large amount without losing cents", () => {
    const quote = quoteCommission({
      loanAmount: "10000000",
      loanTermInMonths: 360,
      riskBand: "HIGH",
    });

    expect(quote.totalCommission).toBe("100000.00");
  });

  it("keeps the same rate when only the term changes", () => {
    const shortTerm = quoteCommission({
      loanAmount: "25000.50",
      loanTermInMonths: 12,
      riskBand: "MEDIUM",
    });
    const longTerm = quoteCommission({
      loanAmount: "25000.50",
      loanTermInMonths: 360,
      riskBand: "MEDIUM",
    });

    expect(shortTerm.commissionRate).toBe("0.0075");
    expect(shortTerm.totalCommission).toBe("187.50");
    expect(longTerm.totalCommission).toBe(shortTerm.totalCommission);
    expect(longTerm.quoteId).not.toBe(shortTerm.quoteId);
  });

  it("rejects a commission that rounds to zero", () => {
    expect(() =>
      quoteCommission({
        loanAmount: "0.50",
        loanTermInMonths: term,
        riskBand: "LOW",
      }),
    ).toThrow();
  });
});
