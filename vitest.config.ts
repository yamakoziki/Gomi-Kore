import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "virtual:pwa-register": path.resolve(__dirname, "src/test-mocks/virtual-pwa-register.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
