# Decisions

Each entry: date, decision, why, alternatives considered. Newest at the bottom.

## 1. Hosting: Cloudflare Workers with static assets plus Durable Objects

**Date:** 2026-11-10

**Decision:** Host the game and its co-op server on Cloudflare: one Worker with static assets, and one `Room` Durable Object per room code. Not Vercel.

**Why:**

- A 3D game ships many megabytes to each visitor. Cloudflare serves static asset requests free and unlimited from its global network. Vercel Hobby includes 100 GB of Fast Data Transfer per month and is for personal, non-commercial use.
- Co-op needs one stateful server per room. A Durable Object per room code holds the shared notebook, Milo and puzzle state and keeps WebSockets open, on the free plan. Vercel Functions can hold WebSockets, but they close when the function reaches its maximum duration, and shared room state needs an external store.
- One Cloudflare deploy serves the game and its multiplayer from the same URL.

**Limits we respect:**

- 25 MiB per static file. 20,000 files per Worker version on Free.
- 100,000 Worker requests per day on Free. Static asset requests do not count, so only `/parties/*` and `/api/*` run the Worker (`run_worker_first`).
- Durable Objects on Free are SQLite-backed only, with daily limits. When a limit is passed, operations fail, so the game must fall back to solo play and say so kindly.
- Never upgrade a plan.

**Alternatives considered:** Vercel (transfer cap, WebSocket time limit, external state store); a separate WebSocket host (two deploys, two URLs, more to break).

**Sources:**

- https://developers.cloudflare.com/workers/platform/limits
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/durable-objects/platform/pricing
- https://developers.cloudflare.com/durable-objects/platform/limits
- https://github.com/cloudflare/partykit
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/functions/websockets

## 2. TypeScript 6, not 7

**Date:** 2026-11-10

**Decision:** Pin `typescript@^6`.

**Why:** `svelte-check` 4.7 declares support for TypeScript 5 and 6 only. TypeScript 7 is the newest release, but our Svelte type checking cannot use it yet.

**Alternatives considered:** TypeScript 7 for `.ts` files and no Svelte checking (loses strict checks in the UI layer). Revisit when `svelte-check` supports 7.

## 3. Three TypeScript projects

**Date:** 2026-11-10

**Decision:** `tsconfig.json` for browser code, `tsconfig.worker.json` for the Worker and Room, `tsconfig.node.json` for scripts, tests and config files. `npm run typecheck` runs all three.

**Why:** browser code needs DOM types, the Worker needs the Workers runtime types from `wrangler types`, and scripts need Node types. Mixing them hides real mistakes, such as using `window` inside the Worker. `src/net/protocol.ts` is shared and is checked under both the browser and Worker projects.

**Alternatives considered:** one config with every type loaded (simpler, but unsafe).

## 4. Solo by default. A room socket opens only when asked

**Date:** 2026-11-10

**Decision:** The client opens no WebSocket unless the player joins a room (for now, a `?room=code` link). Solo play never touches the Worker after the page loads.

**Why:** keeps free-tier Durable Object use for real co-op sessions, and keeps solo play working when the room server is busy or offline (Game Bible section 8).

**Alternatives considered:** always connect to a personal room (simpler state model, but spends requests on every solo visitor).

## 5. Kid-safe wire protocol from day one

**Date:** 2026-11-10

**Decision:** Every co-op message is a typed JSON object checked by a decoder on both ends. No message type has a free-text field. Players are counted seats, never names. Room codes must match lowercase words and digits joined by dashes. Rooms hold at most 4 players.

**Why:** the kid safety rules in `CLAUDE.md`. Building the validator first means later message types cannot quietly add text.

**Alternatives considered:** raw JSON passthrough between clients (fast to build, unsafe).

## 6. Fact check rules

**Date:** 2026-11-10

**Decision:** `npm run check:facts` fails when (a) a fact marked `checked` has no source title and https URL, (b) game text references a fact ID that does not exist, (c) game text uses a fact that has no source or is still marked `verify`, (d) IDs repeat or kid wording has an em dash. Facts marked `verify` with no source yet are allowed only while nothing uses them, and are reported as warnings. The check runs at the start of `npm run build`.

**Why:** `CLAUDE.md` says the check fails if any fact lacks a source. The Fact Sheet also seeds 21 `verify` rows that have no source yet. Blocking those from use, rather than failing the build on day one, keeps both promises: nothing unsourced can reach a player.

Fact references in content are written `[F:fact-id]`, `{F:fact-id}` or `fact("fact-id")`.

Seeded facts have `checkedOn: null` and an empty `deeper` field. Both get filled when someone opens the source and re-reads it. Nothing is invented.

**Alternatives considered:** fail on every `verify` row (blocks all builds until research is done); allow `verify` facts in game text with a warning (breaks the accuracy promise).

## 7. WebGL2, not WebGPU

**Date:** 2026-11-10

**Decision:** Render with Three.js `WebGLRenderer`.

**Why:** the targets are school laptops and mid-range phones. WebGL2 runs on all of them today. The toon, outline and grain passes we need are simple in GLSL.

**Alternatives considered:** `WebGPURenderer` with TSL (newer, but uneven support on the devices we care about).

## 8. End-to-end tests run two browsers at a time

**Date:** 2026-11-10

**Decision:** Playwright uses `workers: 2`.

**Why:** headless Chromium draws WebGL on the CPU. With eight pages at once the machine stalled and room sockets timed out before connecting. The same tests pass every time at two workers. This was a test-load problem, not a game bug.

**Alternatives considered:** skip rendering in tests (would hide real WebGL errors).

## 9. Skills are not committed to the repo

**Date:** 2026-11-10

**Decision:** `.claude/skills/` is git-ignored. `skills-lock.json` is committed and pins each skill by source and hash. Restore with `npx skills experimental_install`.

**Why:** the repo is public and MIT. The skills are other people's work under their own terms (some ship a separate `LICENSE.txt`), and they add about 1,700 files that are not part of the game. The lock file keeps the setup repeatable without republishing them.

**Alternatives considered:** commit the skills (simple to resume, but republishes third-party files under our repo and bloats it).
