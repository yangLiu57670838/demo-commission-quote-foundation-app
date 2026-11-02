import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const envDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, envDir, "");
  const bffUrl = process.env.BFF_URL || fileEnv.BFF_URL || "http://localhost:4000";

  return {
    envDir,
    envPrefix: "VITE_",
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/graphql": bffUrl,
      },
    },
  };
});
