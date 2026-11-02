import { readBffConfig } from "./config";
import { createGraphqlServer } from "./server";

const port = 4000;

const configResult = readBffConfig(process.env);
if (!configResult.ok) {
  console.error(configResult.message);
  process.exit(1);
}

const config = configResult.config;

async function main() {
  const httpServer = await createGraphqlServer(config);
  await new Promise<void>((resolve) => {
    httpServer.listen(port, resolve);
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
