import http, { type Server } from "node:http";
import { quoteResponseSchema } from "@commission-quote/contracts";
import express, { type Express } from "express";
import request from "supertest";
import { createApp } from "../../mock-vendor/src/app";
import type { VendorAppConfig } from "../../mock-vendor/src/config";
import type { BffConfig } from "../src/config";
import { QUOTES_DISABLED_MESSAGE } from "../src/quoteLog";
import { createGraphqlServer } from "../src/server";
import { QUOTE_TIMEOUT_MESSAGE, QUOTE_UNAVAILABLE_MESSAGE } from "../src/vendorClient";

const API_KEY = "server-test-key";
const BROWSER_KEY = "browser-test-key";

const validInput = {
  loanAmount: "10000",
  loanTermInMonths: 12,
  riskBand: "LOW",
};

const MUTATION = `mutation Generate($input: QuoteInput!) {
  generateCommissionQuote(input: $input) {
    quoteId
    commissionRate
    totalCommission
  }
}`;

type QuotePayload = {
  quoteId: string;
  commissionRate: string;
  totalCommission: string;
};

type GraphqlBody = {
  data?: { generateCommissionQuote?: QuotePayload | null } | null;
  errors?: { message?: string; extensions?: unknown; path?: unknown }[];
};

type VendorCall = {
  apiKey?: string;
  requestId?: string;
  simulate?: string;
};

type Running = {
  server: Server;
  port: number;
  url: string;
  close: () => Promise<void>;
};

function vendorConfig(): VendorAppConfig {
  return {
    apiKey: API_KEY,
    failureRate: 1,
    simulation: "forced",
    slowReplyMs: 400,
    random: () => 0,
  };
}

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function portOf(server: http.Server): number {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP port");
  }
  return address.port;
}

async function startRecordingVendor(): Promise<Running & { calls: VendorCall[] }> {
  const calls: VendorCall[] = [];
  const app: Express = express();
  app.use((req, _res, next) => {
    calls.push({
      apiKey: req.get("api-key"),
      requestId: req.get("x-request-id"),
      simulate: req.get("x-simulate"),
    });
    next();
  });
  app.use(createApp(vendorConfig()));
  const server = http.createServer(app);
  await listen(server);
  const port = portOf(server);
  return {
    server,
    port,
    url: `http://127.0.0.1:${port}`,
    calls,
    close: () => close(server),
  };
}

async function startBff(config: BffConfig): Promise<Running> {
  const server = await createGraphqlServer(config);
  await listen(server);
  const port = portOf(server);
  return {
    server,
    port,
    url: `http://127.0.0.1:${port}`,
    close: () => close(server),
  };
}

function bffConfig(
  vendorUrl: string,
  overrides: Partial<
    Pick<BffConfig, "vendorApiKey" | "vendorTimeoutMs" | "vendorSimulate" | "quotesEnabled">
  > = {},
): BffConfig {
  return {
    vendorApiUrl: vendorUrl,
    vendorApiKey: API_KEY,
    vendorTimeoutMs: 1000,
    quotesEnabled: true,
    ...overrides,
  };
}

function postQuote(
  server: Server,
  input: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string; body: GraphqlBody }> {
  let call = request(server).post("/graphql").set("content-type", "application/json");
  for (const [name, value] of Object.entries(headers)) {
    call = call.set(name, value);
  }
  return call.send({ query: MUTATION, variables: { input } }).then((response) => ({
    status: response.status,
    text: response.text,
    body: response.body as GraphqlBody,
  }));
}

function expectNoSecrets(text: string, vendorUrl: string) {
  expect(text).not.toContain(API_KEY);
  expect(text).not.toContain(BROWSER_KEY);
  expect(text).not.toContain(vendorUrl);
  expect(text).not.toContain("stacktrace");
  expect(text).not.toContain("node_modules");
  expect(text).not.toContain("VENDOR_API");
}

function lastCall(calls: VendorCall[]): VendorCall {
  const call = calls[calls.length - 1];
  if (call === undefined) {
    throw new Error("Expected the vendor to be called");
  }
  return call;
}

describe("generateCommissionQuote", () => {
  let vendor: Running & { calls: VendorCall[] };
  let successBff: Running;
  let badKeyBff: Running;
  let errorBff: Running;
  let timeoutBff: Running;

  beforeAll(async () => {
    vendor = await startRecordingVendor();
    [successBff, badKeyBff, errorBff, timeoutBff] = await Promise.all([
      startBff(bffConfig(vendor.url, { vendorSimulate: "success" })),
      startBff(
        bffConfig(vendor.url, { vendorApiKey: "wrong-test-key", vendorSimulate: "success" }),
      ),
      startBff(bffConfig(vendor.url, { vendorSimulate: "error" })),
      startBff(bffConfig(vendor.url, { vendorSimulate: "timeout", vendorTimeoutMs: 50 })),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      successBff.close(),
      badKeyBff.close(),
      errorBff.close(),
      timeoutBff.close(),
    ]);
    await vendor.close();
  });

  it("returns a quote for valid input in forced success mode", async () => {
    const { status, text, body } = await postQuote(successBff.server, validInput, {
      "api-key": BROWSER_KEY,
      "x-simulate": "error",
    });
    const quote = quoteResponseSchema.parse(body.data?.generateCommissionQuote);

    expect(status).toBe(200);
    expect(quote).toMatchObject({
      commissionRate: "0.005",
      totalCommission: "50.00",
    });
    expect(quote.quoteId.length).toBeGreaterThan(0);
    const call = lastCall(vendor.calls);
    expect(call.apiKey).toBe(API_KEY);
    expect(call.simulate).toBe("success");
    expect(call.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expectNoSecrets(text, vendor.url);
  });

  it("returns the quote when the browser does not send an api-key", async () => {
    const { text, body } = await postQuote(successBff.server, validInput);
    const quote = quoteResponseSchema.parse(body.data?.generateCommissionQuote);

    expect(quote.quoteId.length).toBeGreaterThan(0);
    expect(quote.commissionRate).toBe("0.005");
    expect(quote.totalCommission).toBe("50.00");
    expect(lastCall(vendor.calls).apiKey).toBe(API_KEY);
    expectNoSecrets(text, vendor.url);
  });

  it.each([
    ["zero amount", { ...validInput, loanAmount: "0" }, "Loan amount must be greater than 0"],
    ["wrong band", { ...validInput, riskBand: "high" }, "Risk band must be LOW, MEDIUM, or HIGH"],
    ["term 12.5", { ...validInput, loanTermInMonths: 12.5 }, undefined],
  ])("rejects %s before calling the vendor", async (_name, input, message) => {
    const before = vendor.calls.length;
    const { text, body } = await postQuote(successBff.server, input);
    expect(vendor.calls.length).toBe(before);
    expect(body.data?.generateCommissionQuote ?? null).toBeNull();
    const errorMessage = body.errors?.[0]?.message ?? "";
    expect(errorMessage.length).toBeGreaterThan(0);
    if (message !== undefined) {
      expect(errorMessage).toBe(message);
    }
    expect(body.errors?.[0]).toEqual({ message: body.errors?.[0]?.message });
    expectNoSecrets(text, vendor.url);
  });

  it("maps a bad vendor key to a safe error", async () => {
    const { text, body } = await postQuote(badKeyBff.server, validInput);
    expect(body.data).toBeNull();
    expect(body.errors).toEqual([{ message: QUOTE_UNAVAILABLE_MESSAGE }]);
    expect(lastCall(vendor.calls).apiKey).toBe("wrong-test-key");
    expect(text).not.toContain("Unauthorized");
    expect(text).not.toContain("wrong-test-key");
    expectNoSecrets(text, vendor.url);
  });

  it("rejects a missing vendor api-key and does not return a quote", async () => {
    const bff = await startBff(
      bffConfig(vendor.url, { vendorApiKey: "", vendorSimulate: "success" }),
    );

    try {
      const { text, body } = await postQuote(bff.server, validInput);
      expect(body.data).toBeNull();
      expect(body.errors).toEqual([{ message: QUOTE_UNAVAILABLE_MESSAGE }]);
      expect(lastCall(vendor.calls).apiKey ?? "").toBe("");
      expect(text).not.toContain("Unauthorized");
      expectNoSecrets(text, vendor.url);
    } finally {
      await bff.close();
    }
  });

  it("maps a forced vendor error to a safe error", async () => {
    const { text, body } = await postQuote(errorBff.server, validInput);
    expect(body.data).toBeNull();
    expect(body.errors).toEqual([{ message: QUOTE_UNAVAILABLE_MESSAGE }]);
    expect(lastCall(vendor.calls).simulate).toBe("error");
    expect(text).not.toContain("quoteId");
    expectNoSecrets(text, vendor.url);
  });

  it("maps a forced slow vendor to a timeout", async () => {
    const started = Date.now();
    const { text, body } = await postQuote(timeoutBff.server, validInput);
    expect(body.data).toBeNull();
    expect(body.errors).toEqual([{ message: QUOTE_TIMEOUT_MESSAGE }]);
    expect(lastCall(vendor.calls).simulate).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(2000);
    expectNoSecrets(text, vendor.url);
  });

  it("rejects the quote before the vendor when the kill switch is off", async () => {
    const logs: string[] = [];
    const spy = jest.spyOn(console, "log").mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
    const bff = await startBff(
      bffConfig(vendor.url, { quotesEnabled: false, vendorSimulate: "success" }),
    );

    try {
      const before = vendor.calls.length;
      const { text, body } = await postQuote(bff.server, validInput, { "api-key": BROWSER_KEY });
      const quoteLogs = logs.filter((line) => line.includes('"outcome"'));

      expect(vendor.calls.length).toBe(before);
      expect(body.data?.generateCommissionQuote ?? null).toBeNull();
      expect(body.errors).toEqual([{ message: QUOTES_DISABLED_MESSAGE }]);
      expectNoSecrets(text, vendor.url);
      expect(quoteLogs).toHaveLength(1);
      const logged = JSON.parse(quoteLogs[0] ?? "{}") as { requestId?: string; outcome?: string };
      expect(logged.outcome).toBe("disabled");
      expect(logged.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      const logText = quoteLogs.join("\n");
      expect(logText).not.toContain(API_KEY);
      expect(logText).not.toContain(BROWSER_KEY);
      expect(logText).not.toContain(vendor.url);
      expect(logText).not.toContain(validInput.loanAmount);
      expect(logText).not.toContain("loanTermInMonths");
      expect(logText).not.toContain("riskBand");
    } finally {
      spy.mockRestore();
      await bff.close();
    }
  });
});

describe("generateCommissionQuote with a vendor body that breaks the contract", () => {
  async function startFixedVendor(body: string): Promise<Running> {
    const server = http.createServer((req, res) => {
      expect(req.headers["api-key"]).toBe(API_KEY);
      expect(req.headers["x-request-id"]).toEqual(expect.any(String));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
    });
    await listen(server);
    const port = portOf(server);
    return {
      server,
      port,
      url: `http://127.0.0.1:${port}`,
      close: () => close(server),
    };
  }

  async function expectSafeFailure(vendorBody: string) {
    const vendor = await startFixedVendor(vendorBody);
    const bff = await startBff(bffConfig(vendor.url, { vendorSimulate: "success" }));

    try {
      const { text, body } = await postQuote(bff.server, validInput);
      expect(body.data).toBeNull();
      expect(body.errors).toEqual([{ message: QUOTE_UNAVAILABLE_MESSAGE }]);
      expect(text).not.toContain("partial-quote");
      expect(text).not.toContain("not-json");
      expectNoSecrets(text, vendor.url);
    } finally {
      await bff.close();
      await vendor.close();
    }
  }

  it("maps bad vendor json to a safe error", async () => {
    await expectSafeFailure("{not-json");
  });

  it("maps a missing quote field to a safe error", async () => {
    await expectSafeFailure(
      JSON.stringify({ quoteId: "partial-quote", commissionRate: "0.005" }),
    );
  });
});
