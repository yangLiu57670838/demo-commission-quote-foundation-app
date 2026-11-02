import { readVendorConfig } from "./config";

describe("readVendorConfig", () => {
  it("requires the vendor api key", () => {
    const result = readVendorConfig({
      VENDOR_API_URL: "http://localhost:4001",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Missing VENDOR_API_KEY");
      expect(result.message).not.toContain("localhost");
    }
  });

  it("defaults the failure rate to about one in five", () => {
    const result = readVendorConfig({ VENDOR_API_KEY: "local-test-key" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.failureRate).toBe(0.2);
      expect(result.config.simulation).toBe("off");
    }
  });

  it("turns simulation on only for the forced value", () => {
    const forced = readVendorConfig({
      VENDOR_API_KEY: "local-test-key",
      VENDOR_SIMULATION: "forced",
    });
    const other = readVendorConfig({
      VENDOR_API_KEY: "local-test-key",
      VENDOR_SIMULATION: "on",
    });

    expect(forced.ok && forced.config.simulation).toBe("forced");
    expect(other.ok && other.config.simulation).toBe("off");
  });

  it("rejects a failure rate outside 0 to 1 without echoing the value", () => {
    const result = readVendorConfig({
      VENDOR_API_KEY: "local-test-key",
      VENDOR_FAILURE_RATE: "2",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("VENDOR_FAILURE_RATE must be a number from 0 to 1");
      expect(result.message).not.toContain("2");
    }
  });
});
