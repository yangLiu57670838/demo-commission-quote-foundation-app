import type { Server } from "node:http";
import { quoteResponseSchema } from "@commission-quote/contracts";
import { createApp } from "./app";
import type { VendorAppConfig } from "./config";

const API_KEY = "local-test-key";

const forcedConfig: VendorAppConfig = {
  apiKey: API_KEY,
  failureRate: 1,
  simulation: "forced",
  slowReplyMs: 50,
  random: () => 0,
};

const validBody = {
  loanAmount: "10000",
  loanTermInMonths: 12,
  riskBand: "LOW",
};

async function start(config: VendorAppConfig): Promise<{ port: number; close: () => Promise<void> }> {
  const server: Server = createApp(config).listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the vendor to listen on a TCP port");
  }
  return {
    port: address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function postQuote(port: number, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`http://127.0.0.1:${port}/commission-quotes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /health", () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ port, close } = await start(forcedConfig));
  });

  afterAll(async () => {
    await close();
  });

  it("answers ok", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });
});

describe("POST /commission-quotes", () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ port, close } = await start(forcedConfig));
  });

  afterAll(async () => {
    await close();
  });

  it("returns a known commission for a good key", async () => {
    const response = await postQuote(port, validBody, {
      "api-key": API_KEY,
      "x-simulate": "success",
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(quoteResponseSchema.parse(body)).toMatchObject({
      commissionRate: "0.005",
      totalCommission: "50.00",
    });
    expect(JSON.stringify(body)).not.toContain(API_KEY);
  });

  it("returns a new quote id for the same loan", async () => {
    const headers = { "api-key": API_KEY, "x-simulate": "success" };
    const first = quoteResponseSchema.parse(await (await postQuote(port, validBody, headers)).json());
    const second = quoteResponseSchema.parse(await (await postQuote(port, validBody, headers)).json());

    expect(first.quoteId).not.toBe(second.quoteId);
    expect(first.totalCommission).toBe(second.totalCommission);
  });

  it("ignores extra json fields", async () => {
    const response = await postQuote(
      port,
      { ...validBody, note: "ignore me" },
      { "api-key": API_KEY, "x-simulate": "success" },
    );
    const body = quoteResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.totalCommission).toBe("50.00");
    expect(body).not.toHaveProperty("note");
  });

  it("rejects a wrong api key", async () => {
    const response = await postQuote(port, validBody, {
      "api-key": "wrong-key",
      "x-simulate": "success",
    });
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).toContain("Unauthorized");
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain("wrong-key");
  });

  it("rejects a missing api key", async () => {
    const response = await postQuote(port, validBody, { "x-simulate": "success" });
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).not.toContain(API_KEY);
  });

  it("rejects a bad key before it reports a bad body", async () => {
    const response = await postQuote(
      port,
      { loanAmount: "0", loanTermInMonths: 12.5, riskBand: "high" },
      { "x-simulate": "success" },
    );

    expect(response.status).toBe(401);
  });

  it.each([
    ["zero amount", { ...validBody, loanAmount: "0" }],
    ["term 12.5", { ...validBody, loanTermInMonths: 12.5 }],
    ["wrong band", { ...validBody, riskBand: "high" }],
    ["numeric amount", { ...validBody, loanAmount: 10000 }],
  ])("rejects a bad body (%s)", async (_name, body) => {
    const response = await postQuote(port, body, {
      "api-key": API_KEY,
      "x-simulate": "success",
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("Invalid quote request");
    expect(text).not.toContain(API_KEY);
  });

  it("rejects invalid json", async () => {
    const response = await postQuote(port, "{", {
      "api-key": API_KEY,
      "x-simulate": "success",
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain("SyntaxError");
  });

  it("returns a forced error instead of a quote", async () => {
    const response = await postQuote(port, validBody, {
      "api-key": API_KEY,
      "x-simulate": "error",
    });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain("Quote unavailable");
    expect(text).not.toContain("quoteId");
    expect(text).not.toContain(API_KEY);
  });

  it("answers slowly when a timeout is forced", async () => {
    const started = Date.now();
    const response = await postQuote(port, validBody, {
      "api-key": API_KEY,
      "x-simulate": "timeout",
    });
    const body = quoteResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
    expect(body.totalCommission).toBe("50.00");
  });
});

describe("POST /commission-quotes without forced simulation", () => {
  it("ignores x-simulate and can be set to never fail", async () => {
    const running = await start({
      ...forcedConfig,
      simulation: "off",
      failureRate: 0,
      random: () => 0,
    });

    try {
      const response = await postQuote(running.port, validBody, {
        "api-key": API_KEY,
        "x-simulate": "error",
      });

      expect(response.status).toBe(200);
    } finally {
      await running.close();
    }
  });

  it("fails every call when the failure rate is 1", async () => {
    const running = await start({
      ...forcedConfig,
      simulation: "off",
      failureRate: 1,
      random: () => 0,
    });

    try {
      const response = await postQuote(running.port, validBody, {
        "api-key": API_KEY,
        "x-simulate": "success",
      });
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).not.toContain("quoteId");
      expect(text).not.toContain(API_KEY);
    } finally {
      await running.close();
    }
  });
});
