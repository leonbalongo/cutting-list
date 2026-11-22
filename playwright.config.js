import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:5173",
    headless: true,
    launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PW_CHROMIUM_EXECUTABLE,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--no-zygote",
            "--use-angle=swiftshader",
          ],
        }
      : {},
  },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: process.env.TEST_PRODUCTION
          ? "npm run preview -- --port 5173"
          : "npm run dev -- --port 5173",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
      },
});
