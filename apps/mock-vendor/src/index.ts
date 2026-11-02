import { createApp } from "./app";
import { readVendorConfig } from "./config";

const config = readVendorConfig(process.env);
if (!config.ok) {
  console.error(config.message);
  process.exit(1);
}

const port = 4001;

createApp(config.config).listen(port, () => {
  console.log(`Mock vendor ready at http://localhost:${port}/health`);
});

process.on("unhandledRejection", (error: unknown) => {
  console.error(error);
  process.exit(1);
});
