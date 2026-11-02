import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export type RunningStack = {
  webUrl: string;
  vendorUrl: string;
  apiKey: string;
  stop: () => Promise<void>;
};

const repoRoot = path.resolve(import.meta.dirname, "../../../..");

export async function startStack(): Promise<RunningStack> {
  const fileEnv = readEnvFile(path.join(repoRoot, ".env.local"));
  const apiKey = fileEnv.VENDOR_API_KEY ?? "";
  if (apiKey.length === 0) {
    throw new Error("E2E needs VENDOR_API_KEY in .env.local");
  }

  const vendorPort = await freePort();
  const bffPort = await freePort();
  const webPort = await freePort();
  const vendorUrl = `http://127.0.0.1:${vendorPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;
  const children: ChildProcess[] = [];

  const vendor = spawnNode(
    path.join(repoRoot, "apps/mock-vendor"),
    ["--import", "tsx", "src/index.ts"],
    {
      PORT: String(vendorPort),
      VENDOR_API_KEY: apiKey,
      VENDOR_SIMULATION: "forced",
      VENDOR_FAILURE_RATE: "0",
    },
  );
  children.push(vendor);

  const bff = spawnNode(
    path.join(repoRoot, "apps/bff"),
    ["--import", "tsx", "src/index.ts"],
    {
      PORT: String(bffPort),
      VENDOR_API_KEY: apiKey,
      VENDOR_API_URL: vendorUrl,
      VENDOR_TIMEOUT_MS: "2000",
      ENABLE_COMMISSION_QUOTE: "true",
    },
  );
  children.push(bff);

  const web = spawnNode(
    path.join(repoRoot, "apps/web"),
    [path.join(repoRoot, "apps/web/node_modules/vite/bin/vite.js"), "--port", String(webPort), "--strictPort", "--host", "127.0.0.1"],
    {
      BFF_URL: `http://127.0.0.1:${bffPort}`,
    },
  );
  children.push(web);

  const stop = async () => {
    for (const child of children) {
      child.kill("SIGTERM");
    }
    await delay(200);
  };

  try {
    await waitForHttp(`${vendorUrl}/health`, apiKey);
    await waitForGraphql(`http://127.0.0.1:${bffPort}/graphql`, apiKey);
    await waitForHttp(webUrl, apiKey);
  } catch (error) {
    await stop();
    const detail = error instanceof Error ? error.message : "The apps did not start";
    throw new Error(redact(detail, apiKey));
  }

  return { webUrl, vendorUrl, apiKey, stop };
}

function spawnNode(cwd: string, args: string[], env: Record<string, string>): ChildProcess {
  return spawn(process.execPath, args, {
    cwd,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readEnvFile(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return env;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Expected a free TCP port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForHttp(url: string, apiKey: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  let lastError = "not ready";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
    await delay(200);
  }
  throw new Error(redact(`Timed out waiting for ${url}: ${lastError}`, apiKey));
}

async function waitForGraphql(url: string, apiKey: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  let lastError = "not ready";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{ health }" }),
      });
      if (response.ok) {
        return;
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
    await delay(200);
  }
  throw new Error(redact(`Timed out waiting for ${url}: ${lastError}`, apiKey));
}

function redact(text: string, apiKey: string): string {
  return apiKey.length === 0 ? text : text.split(apiKey).join("[redacted]");
}
