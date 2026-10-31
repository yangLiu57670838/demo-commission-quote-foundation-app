import type { Server } from "node:http";
import { createGraphqlServer } from "./server";

describe("POST /graphql", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = await createGraphqlServer();
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the BFF to listen on a TCP port");
    }
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("answers a health query", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ health }" }),
    });
    const body = (await response.json()) as { data: { health: string } };

    expect(response.status).toBe(200);
    expect(body.data.health).toBe("ok");
  });
});
