import { configDefaults, defineConfig } from "vitest/config";
import { supabaseTestConfig } from "./src/test/supabase-config";
import config from "./vitest.config";

supabaseTestConfig();

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["src/**/*.integration.test.ts"],
    exclude: configDefaults.exclude,
  },
});
