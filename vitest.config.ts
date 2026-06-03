import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@/domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
      "@/application": fileURLToPath(new URL("./src/application", import.meta.url)),
      "@/infrastructure": fileURLToPath(new URL("./src/infrastructure", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
