import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "geist/font/sans": fileURLToPath(
        new URL("./src/test/stubs/geist-font.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts"],
  },
});
