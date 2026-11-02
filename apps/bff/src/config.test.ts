import { DEFAULT_VENDOR_TIMEOUT_MS, readBffConfig } from "./config";

const API_KEY = "local-test-key";

describe("readBffConfig", () => {
  it("requires the vendor key and url", () => {
    const missingKey = readBffConfig({ VENDOR_API_URL: "http://localhost:4001" });
    const missingUrl = readBffConfig({ VENDOR_API_KEY: API_KEY });

    expect(missingKey.ok).toBe(false);
    expect(missingUrl.ok).toBe(false);
    if (!missingKey.ok && !missingUrl.ok) {
      expect(missingKey.message).toBe("Missing VENDOR_API_KEY or VENDOR_API_URL");
      expect(missingUrl.message).toBe("Missing VENDOR_API_KEY or VENDOR_API_URL");
      expect(missingUrl.message).not.toContain(API_KEY);
    }
  });

  it("reads a vendor origin and the default timeout", () => {
    const result = readBffConfig({
      VENDOR_API_KEY: API_KEY,
      VENDOR_API_URL: "http://localhost:4001/commission-quotes",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.vendorApiUrl).toBe("http://localhost:4001");
      expect(result.config.vendorApiKey).toBe(API_KEY);
      expect(result.config.vendorTimeoutMs).toBe(DEFAULT_VENDOR_TIMEOUT_MS);
      expect(result.config.vendorSimulate).toBeUndefined();
      expect(result.config.quotesEnabled).toBe(true);
    }
  });

  it("turns quotes off only when the flag is false", () => {
    const disabled = readBffConfig({
      VENDOR_API_KEY: API_KEY,
      VENDOR_API_URL: "http://localhost:4001",
      ENABLE_COMMISSION_QUOTE: "false",
    });
    const enabled = readBffConfig({
      VENDOR_API_KEY: API_KEY,
      VENDOR_API_URL: "http://localhost:4001",
      ENABLE_COMMISSION_QUOTE: "TRUE",
    });
    const invalid = readBffConfig({
      VENDOR_API_KEY: API_KEY,
      VENDOR_API_URL: "http://localhost:4001",
      ENABLE_COMMISSION_QUOTE: API_KEY,
    });

    expect(disabled.ok && disabled.config.quotesEnabled).toBe(false);
    expect(enabled.ok && enabled.config.quotesEnabled).toBe(true);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.message).toBe("ENABLE_COMMISSION_QUOTE must be true or false");
      expect(invalid.message).not.toContain(API_KEY);
    }
  });

  it("does not take a simulate mode from the environment", () => {
    const result = readBffConfig({
      VENDOR_API_KEY: API_KEY,
      VENDOR_API_URL: "http://localhost:4001",
      VENDOR_SIMULATION: "forced",
      VENDOR_TIMEOUT_MS: "1500",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.vendorTimeoutMs).toBe(1500);
      expect(result.config.vendorSimulate).toBeUndefined();
    }
  });

  it("rejects a url that carries a secret without echoing it", () => {
    const secret = "super-secret-key";
    const result = readBffConfig({
      VENDOR_API_KEY: API_KEY,
      VENDOR_API_URL: `http://user:${secret}@localhost:4001/commission-quotes?api-key=${secret}`,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("VENDOR_API_URL must be an http(s) URL");
      expect(result.message).not.toContain(secret);
      expect(result.message).not.toContain(API_KEY);
    }
  });

  it("rejects a bad timeout without echoing the value", () => {
    const result = readBffConfig({
      VENDOR_API_KEY: API_KEY,
      VENDOR_API_URL: "http://localhost:4001",
      VENDOR_TIMEOUT_MS: API_KEY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("VENDOR_TIMEOUT_MS must be a positive whole number");
      expect(result.message).not.toContain(API_KEY);
    }
  });
});
