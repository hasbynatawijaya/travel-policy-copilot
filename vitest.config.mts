import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Load DATABASE_URL for the integration tests; the file is git-ignored.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No local env file: integration tests skip themselves.
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
