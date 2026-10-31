import type { Server } from "node:http";
import { createApp } from "./app";

describe("GET /health", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createApp().listen(0);
    await new Promise<void>((resolve) => {
      server.once("listening", () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the health server to listen on a TCP port");
    }
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("answers ok", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });
});
