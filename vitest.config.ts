import { defineConfig } from "vitest/config";

// Unit tests run in plain Node, without the Cloudflare or Svelte plugins.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
