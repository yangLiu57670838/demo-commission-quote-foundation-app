import { quoteLogLine } from "./quoteLog";

const API_KEY = "server-test-key";
const VENDOR_URL = "http://127.0.0.1:4001";

describe("quoteLogLine", () => {
  it("writes the request id and outcome without the loan body", () => {
    const line = quoteLogLine(
      { requestId: "11111111-1111-4111-8111-111111111111", outcome: "quoted" },
      [API_KEY, VENDOR_URL],
    );

    expect(JSON.parse(line)).toEqual({
      requestId: "11111111-1111-4111-8111-111111111111",
      outcome: "quoted",
    });
    expect(line).not.toContain("loanAmount");
    expect(line).not.toContain("10000");
    expect(line).not.toContain(API_KEY);
    expect(line).not.toContain(VENDOR_URL);
  });

  it("redacts the api key and the vendor url when they appear in the line", () => {
    const line = quoteLogLine(
      { requestId: `req-${API_KEY}`, outcome: "failed" },
      [API_KEY, VENDOR_URL],
    );

    expect(line).not.toContain(API_KEY);
    expect(line).toContain("[redacted]");
    expect(JSON.parse(line)).toMatchObject({ outcome: "failed" });
  });
});
