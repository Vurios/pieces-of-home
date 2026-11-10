// Deploys dist/client to Cloudflare Pages (https://piecesofhome.pages.dev).
//
// The Cloudflare Vite plugin writes .wrangler/deploy/config.json, which points
// every Wrangler command at the Worker's generated config. Pages would then
// ignore pages/wrangler.toml, so we move the redirect aside while Pages
// deploys. The next build writes it again.
import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const redirect = `${root}.wrangler/deploy/config.json`;
const parked = `${redirect}.parked`;
if (existsSync(redirect)) renameSync(redirect, parked);
try {
  execSync("npx wrangler pages deploy --branch main --commit-dirty=true", { cwd: `${root}pages`, stdio: "inherit" });
} finally {
  if (existsSync(parked)) renameSync(parked, redirect);
}
