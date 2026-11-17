import { defineConfig, devices } from "@playwright/test";

// Test accounts and Supabase keys come from .env / .env.local (see .env.example).
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file is optional
  }
}

const PORT = 3100;

/**
 * End-to-end tests against a production build of the web app plus the local
 * collaboration server. Both are started automatically; set
 * PLAYWRIGHT_BASE_URL to test a running deployment instead.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: `npm run build && npx next start -p ${PORT}`,
          url: `http://localhost:${PORT}/login`,
          timeout: 240_000,
          reuseExistingServer: !process.env.CI,
          // Invite links in the share dialog must point at this server.
          env: { NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
        },
        {
          command: "npm --prefix server run dev",
          url: "http://127.0.0.1:1234/health",
          timeout: 60_000,
          reuseExistingServer: true,
        },
      ],
});
