import { quoteLogLine } from "./quoteLog";

const API_KEY = "server-test-key";
const VENDOR_URL = "http://127.0.0.1:4001";

describe("quoteLogLine", () => {
  it("writes the trace id and outcome without the loan body", () => {
    const line = quoteLogLine(
      {
        level: "info",
        traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        spanId: "bbbbbbbbbbbbbbbb",
        outcome: "quoted",
        quoteId: "quote-1",
      },
      [API_KEY, VENDOR_URL],
    );

    expect(JSON.parse(line)).toEqual({
      level: "info",
      traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      spanId: "bbbbbbbbbbbbbbbb",
      outcome: "quoted",
      quoteId: "quote-1",
    });
    expect(line).not.toContain("loanAmount");
    expect(line).not.toContain("10000");
    expect(line).not.toContain(API_KEY);
    expect(line).not.toContain(VENDOR_URL);
  });

  it("redacts the api key and the vendor url when they appear in the line", () => {
    const line = quoteLogLine(
      {
        level: "error",
        traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        spanId: "bbbbbbbbbbbbbbbb",
        outcome: "failed",
        reason: `call ${API_KEY}`,
      },
      [API_KEY, VENDOR_URL],
    );

    expect(line).not.toContain(API_KEY);
    expect(line).toContain("[redacted]");
    expect(JSON.parse(line)).toMatchObject({ outcome: "failed" });
  });
});
