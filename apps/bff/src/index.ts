import { createGraphqlServer } from "./server";

const port = 4000;

async function main() {
  const httpServer = await createGraphqlServer();
  await new Promise<void>((resolve) => {
    httpServer.listen(port, resolve);
  });
  console.log(`BFF ready at http://localhost:${port}/graphql`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
