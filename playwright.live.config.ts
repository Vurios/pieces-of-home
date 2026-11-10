import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Smoke test against the deployed site: `npm run e2e:live`.
// Set LIVE_URL to override the default workers.dev address.
const liveUrl = process.env["LIVE_URL"] ?? "https://piecesofhome.pages.dev";

export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL: liveUrl },
});
