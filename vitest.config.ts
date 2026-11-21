import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        ...configDefaults.exclude,
        "**/*.config.*",
        "**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.integration.test.ts",
        "src/test/**",
      ],
      thresholds: {
        statements: 55,
        branches: 40,
        functions: 48,
        lines: 65,
      },
    },
  },
});
