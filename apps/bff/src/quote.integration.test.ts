import http from "node:http";
import { quoteResponseSchema } from "@commission-quote/contracts";
import express, { type Express } from "express";
import { createApp } from "../../mock-vendor/src/app";
import type { VendorAppConfig } from "../../mock-vendor/src/config";
import type { BffConfig } from "./config";
import { createGraphqlServer } from "./server";
import { QUOTE_TIMEOUT_MESSAGE, QUOTE_UNAVAILABLE_MESSAGE } from "./vendorClient";

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
    port,
    url: `http://127.0.0.1:${port}`,
    close: () => close(server),
  };
}

function bffConfig(
  vendorUrl: string,
  overrides: Partial<Pick<BffConfig, "vendorApiKey" | "vendorTimeoutMs" | "vendorSimulate">> = {},
): BffConfig {
  return {
    vendorApiUrl: vendorUrl,
    vendorApiKey: API_KEY,
    vendorTimeoutMs: 1000,
    ...overrides,
  };
}

function postQuote(
  port: number,
  input: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ query: MUTATION, variables: { input } }),
  });
}

async function readGraphql(response: Response): Promise<{ status: number; text: string; body: GraphqlBody }> {
  const text = await response.text();
  return {
    status: response.status,
    text,
    body: JSON.parse(text) as GraphqlBody,
  };
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
    const response = await postQuote(successBff.port, validInput, {
      "api-key": BROWSER_KEY,
      "x-simulate": "error",
    });
    const { status, text, body } = await readGraphql(response);
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

  it.each([
    ["zero amount", { ...validInput, loanAmount: "0" }, "Loan amount must be greater than 0"],
    ["wrong band", { ...validInput, riskBand: "high" }, "Risk band must be LOW, MEDIUM, or HIGH"],
    ["term 12.5", { ...validInput, loanTermInMonths: 12.5 }, undefined],
  ])("rejects %s before calling the vendor", async (_name, input, message) => {
    const before = vendor.calls.length;
    const response = await postQuote(successBff.port, input);
    const { text, body } = await readGraphql(response);

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
    const response = await postQuote(badKeyBff.port, validInput);
    const { text, body } = await readGraphql(response);

    expect(body.data).toBeNull();
    expect(body.errors).toEqual([{ message: QUOTE_UNAVAILABLE_MESSAGE }]);
    expect(lastCall(vendor.calls).apiKey).toBe("wrong-test-key");
    expect(text).not.toContain("Unauthorized");
    expect(text).not.toContain("wrong-test-key");
    expectNoSecrets(text, vendor.url);
  });

  it("maps a forced vendor error to a safe error", async () => {
    const response = await postQuote(errorBff.port, validInput);
    const { text, body } = await readGraphql(response);

    expect(body.data).toBeNull();
    expect(body.errors).toEqual([{ message: QUOTE_UNAVAILABLE_MESSAGE }]);
    expect(lastCall(vendor.calls).simulate).toBe("error");
    expect(text).not.toContain("quoteId");
    expectNoSecrets(text, vendor.url);
  });

  it("maps a forced slow vendor to a timeout", async () => {
    const started = Date.now();
    const response = await postQuote(timeoutBff.port, validInput);
    const { text, body } = await readGraphql(response);

    expect(body.data).toBeNull();
    expect(body.errors).toEqual([{ message: QUOTE_TIMEOUT_MESSAGE }]);
    expect(lastCall(vendor.calls).simulate).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(2000);
    expectNoSecrets(text, vendor.url);
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
      port,
      url: `http://127.0.0.1:${port}`,
      close: () => close(server),
    };
  }

  async function expectSafeFailure(vendorBody: string) {
    const vendor = await startFixedVendor(vendorBody);
    const bff = await startBff(bffConfig(vendor.url, { vendorSimulate: "success" }));

    try {
      const response = await postQuote(bff.port, validInput);
      const { text, body } = await readGraphql(response);

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
