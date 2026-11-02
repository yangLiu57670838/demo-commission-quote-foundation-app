import http from "node:http";
import { quoteResponseSchema } from "@commission-quote/contracts";
import type { BffConfig, VendorSimulate } from "./config";
import {
  QUOTE_TIMEOUT_MESSAGE,
  QUOTE_UNAVAILABLE_MESSAGE,
  VendorCallError,
  publicErrorMessage,
  requestCommissionQuote,
} from "./vendorClient";

const API_KEY = "local-test-key";
const VENDOR_URL_LEAK = "http://vendor.internal/secret";

const validInput = {
  loanAmount: "10000",
  loanTermInMonths: 12,
  riskBand: "LOW" as const,
};

const validQuote = {
  quoteId: "quote-1",
  commissionRate: "0.005",
  totalCommission: "50.00",
};

type CapturedRequest = {
  apiKey?: string;
  requestId?: string;
  simulate?: string;
  body?: string;
};

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected the stub vendor to listen on a TCP port");
      }
      resolve(address.port);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function startStub(
  respond: (res: http.ServerResponse, captured: CapturedRequest) => void,
): Promise<{ port: number; captured: CapturedRequest; stop: () => Promise<void> }> {
  const captured: CapturedRequest = {};
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      captured.apiKey = headerValue(req.headers["api-key"]);
      captured.requestId = headerValue(req.headers["x-request-id"]);
      captured.simulate = headerValue(req.headers["x-simulate"]);
      captured.body = Buffer.concat(chunks).toString("utf8");
      respond(res, captured);
    });
  });
  const port = await listen(server);
  return { port, captured, stop: () => close(server) };
}

function configFor(port: number, simulate?: VendorSimulate, timeoutMs = 1000): BffConfig {
  return {
    vendorApiUrl: `http://127.0.0.1:${port}`,
    vendorApiKey: API_KEY,
    vendorTimeoutMs: timeoutMs,
    ...(simulate === undefined ? {} : { vendorSimulate: simulate }),
  };
}

function leakedBody(payload: unknown): string {
  return JSON.stringify({
    ...(typeof payload === "object" && payload !== null ? payload : {}),
    error: API_KEY,
    url: VENDOR_URL_LEAK,
    stack: "Error\n    at vendor (node_modules/vendor/index.js:1:1)",
  });
}

describe("publicErrorMessage", () => {
  const config = { vendorApiKey: API_KEY, vendorApiUrl: "http://127.0.0.1:4001" };

  it("keeps a short validation or timeout message", () => {
    expect(publicErrorMessage("Loan amount must be greater than 0", config)).toBe(
      "Loan amount must be greater than 0",
    );
    expect(publicErrorMessage(QUOTE_TIMEOUT_MESSAGE, config)).toBe(QUOTE_TIMEOUT_MESSAGE);
  });

  it("replaces a message that contains the key, the vendor url, or a stack", () => {
    expect(publicErrorMessage(`failed with ${API_KEY}`, config)).toBe(QUOTE_UNAVAILABLE_MESSAGE);
    expect(publicErrorMessage(`failed calling ${config.vendorApiUrl}`, config)).toBe(
      QUOTE_UNAVAILABLE_MESSAGE,
    );
    expect(publicErrorMessage("Error\n    at vendor (node_modules/vendor/index.js:1:1)", config)).toBe(
      QUOTE_UNAVAILABLE_MESSAGE,
    );
  });
});

describe("requestCommissionQuote", () => {
  it("posts the api key, a request id, and the loan body", async () => {
    const stub = await startStub((_res, captured) => {
      _res.writeHead(200, { "content-type": "application/json" });
      _res.end(JSON.stringify({ ...validQuote, debug: API_KEY }));
      expect(captured.simulate).toBe("success");
    });

    try {
      const quote = await requestCommissionQuote(configFor(stub.port, "success"), validInput);

      expect(quoteResponseSchema.parse(quote)).toEqual(validQuote);
      expect(quote).not.toHaveProperty("debug");
      expect(stub.captured.apiKey).toBe(API_KEY);
      expect(stub.captured.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(stub.captured.body).toBe(JSON.stringify(validInput));
      expect(stub.captured.body).not.toContain(API_KEY);
    } finally {
      await stub.stop();
    }
  });

  it("omits x-simulate unless the server config sets it", async () => {
    const stub = await startStub((res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(validQuote));
    });

    try {
      await requestCommissionQuote(configFor(stub.port), validInput);
      expect(stub.captured.simulate).toBeUndefined();
    } finally {
      await stub.stop();
    }
  });

  it.each([
    ["401", 401, leakedBody({ error: "Unauthorized" })],
    ["500", 500, leakedBody({ error: "Quote unavailable" })],
    ["bad json", 200, "{"],
    ["missing quote field", 200, JSON.stringify({ quoteId: "quote-1", commissionRate: "0.005" })],
  ])("maps %s to a safe message", async (_name, status, body) => {
    const stub = await startStub((res) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body);
    });

    try {
      const error = await requestCommissionQuote(configFor(stub.port, "success"), validInput).then(
        () => {
          throw new Error("Expected the vendor call to fail");
        },
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(VendorCallError);
      expect(error).toMatchObject({ message: QUOTE_UNAVAILABLE_MESSAGE, kind: "unavailable" });
      const text = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : "";
      expect(error instanceof Error ? error.message : "").not.toContain("node_modules");
      expect(text).not.toContain(API_KEY);
      expect(text).not.toContain(VENDOR_URL_LEAK);
    } finally {
      await stub.stop();
    }
  });

  it("maps a slow vendor to a timeout message", async () => {
    const stub = await startStub((res) => {
      const timer = setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(validQuote));
      }, 1000);
      res.req.on("close", () => {
        clearTimeout(timer);
      });
    });

    try {
      const started = Date.now();
      const error = await requestCommissionQuote(configFor(stub.port, "timeout", 40), validInput).then(
        () => {
          throw new Error("Expected the vendor call to time out");
        },
        (caught: unknown) => caught,
      );

      expect(error).toMatchObject({ message: QUOTE_TIMEOUT_MESSAGE, kind: "timeout" });
      expect(Date.now() - started).toBeLessThan(800);
      const text = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : "";
      expect(text).not.toContain(API_KEY);
      expect(text).not.toContain(`127.0.0.1:${stub.port}`);
    } finally {
      await stub.stop();
    }
  });

  it("maps a dropped connection without the vendor url", async () => {
    const server = http.createServer((req) => {
      req.socket.destroy();
    });
    const port = await listen(server);

    try {
      const vendorApiUrl = `http://127.0.0.1:${port}`;
      const error = await requestCommissionQuote(
        { vendorApiUrl, vendorApiKey: API_KEY, vendorTimeoutMs: 500 },
        validInput,
      ).then(
        () => {
          throw new Error("Expected the vendor call to fail");
        },
        (caught: unknown) => caught,
      );

      expect(error).toMatchObject({ message: QUOTE_UNAVAILABLE_MESSAGE });
      const text = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : "";
      expect(text).not.toContain(vendorApiUrl);
      expect(text).not.toContain(API_KEY);
    } finally {
      await close(server);
    }
  });
});
