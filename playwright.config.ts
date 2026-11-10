import { defineConfig, devices } from "@playwright/test";

// Local e2e: starts `npm run dev`, which runs the real Workers runtime.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  // Headless runs draw WebGL on the CPU. More than two pages at once starves
  // the machine and room sockets time out before they connect.
  workers: 2,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    // Software WebGL keeps the 3D canvas working in headless runs.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/api/health",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
