import { timingSafeEqual } from "node:crypto";
import { quoteRequestSchema } from "@commission-quote/contracts";
import express, { type NextFunction, type Request, type Response } from "express";
import { quoteCommission } from "./commission";
import type { VendorAppConfig } from "./config";

const QUOTE_PATH = "/commission-quotes";

function apiKeyMatches(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) {
    return false;
  }
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

function nextFault(req: Request, config: VendorAppConfig): "ok" | "error" | "timeout" {
  if (config.simulation === "forced") {
    const header = req.get("x-simulate");
    if (header === "success") {
      return "ok";
    }
    if (header === "error" || header === "timeout") {
      return header;
    }
  }
  return config.random() < config.failureRate ? "error" : "ok";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError && "body" in error;
}

export function createApp(config: VendorAppConfig) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.post(QUOTE_PATH, async (req, res) => {
    const providedKey = req.get("api-key");
    if (!apiKeyMatches(providedKey, config.apiKey)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = quoteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid quote request" });
      return;
    }

    const fault = nextFault(req, config);
    if (fault === "error") {
      res.status(500).json({ error: "Quote unavailable" });
      return;
    }
    if (fault === "timeout") {
      await delay(config.slowReplyMs);
    }
    if (res.headersSent) {
      return;
    }

    try {
      res.status(200).json(quoteCommission(parsed.data));
    } catch {
      res.status(500).json({ error: "Quote unavailable" });
    }
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (isJsonParseError(error)) {
      res.status(400).json({ error: "Invalid quote request" });
      return;
    }
    res.status(500).json({ error: "Quote unavailable" });
  });

  return app;
}
