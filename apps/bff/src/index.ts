import { readBffConfig } from "./config";
import { createGraphqlServer } from "./server";

const port = listenPort(process.env.PORT, 4000);

const configResult = readBffConfig(process.env);
if (!configResult.ok) {
  console.error(configResult.message);
  process.exit(1);
}

const config = configResult.config;

function listenPort(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  if (!/^\d+$/.test(value.trim())) {
    console.error("PORT must be a whole number from 1 to 65535");
    process.exit(1);
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error("PORT must be a whole number from 1 to 65535");
    process.exit(1);
  }
  return parsed;
}

async function main() {
  const httpServer = await createGraphqlServer(config);
  await new Promise<void>((resolve) => {
    httpServer.listen(port, "0.0.0.0", resolve);
  });
  console.log(`BFF ready at http://localhost:${port}/graphql`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (error: unknown) => {
  console.error(error);
  process.exit(1);
});
