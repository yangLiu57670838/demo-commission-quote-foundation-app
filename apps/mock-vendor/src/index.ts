import { createApp } from "./app";
import { readVendorConfig } from "./config";

const config = readVendorConfig(process.env);
if (!config.ok) {
  console.error(config.message);
  process.exit(1);
}

const port = listenPort(process.env.PORT, 4001);

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

createApp(config.config).listen(port, "0.0.0.0", () => {
  console.log(`Mock vendor ready at http://localhost:${port}/health`);
});

process.on("unhandledRejection", (error: unknown) => {
  console.error(error);
  process.exit(1);
});
