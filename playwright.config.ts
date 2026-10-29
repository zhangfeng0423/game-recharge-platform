import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", headless: true },
  webServer: [
    {
      command: "node tests/fixture-supabase.mjs",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
    },
    {
      command: "pnpm build && pnpm start --port 3100",
      url: "http://127.0.0.1:3100/en/auth",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        BUILD_DIR: ".next-e2e",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
        PAYMENTS_ENABLED: "false",
      },
    },
  ],
});
