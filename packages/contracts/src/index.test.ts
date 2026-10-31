import { CONTRACT_PACKAGE } from "./index";

describe("contracts package", () => {
  it("is ready for the shared quote schema", () => {
    expect(CONTRACT_PACKAGE).toBe("@commission-quote/contracts");
  });
});
