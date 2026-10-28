import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...(process.env["BROWSER_CHANNEL"]
      ? { channel: process.env["BROWSER_CHANNEL"] }
      : {}),
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
  },
});
