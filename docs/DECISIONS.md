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

## 10. No CI. Push straight to main

**Date:** 2026-11-10

**Decision:** The GitHub Actions workflow is removed. Work is pushed straight to `main`.

**Why:** the team asked for it. Typecheck, unit tests, the fact check and the Playwright tests still run locally before every push and deploy, so `main` stays deployable.

**Alternatives considered:** keep CI on every push (the team chose not to).

## 11. Characters are built in code, not taken from a pack

**Date:** 2026-11-11

**Decision:** The four kids and Milo are procedural chibi models made from simple shapes in `src/game/actors/`, with procedural animation (walk, run, jump, land, carry, interact, emote, celebrate, and one personality idle each).

**Why:** the Game Bible asks for exact silhouettes (Remi's backpack, Nori's cap, Lumi's beret and sketchbook, Theo's goggles and tool belt) and for Milo to gain parts stage by stage. Building in code gives full control of each silhouette, shares one rig, costs no download, and matches the toon and ink look by construction. Milo is one modular model whose parts show by stage.

**Alternatives considered:** CC0 rigged packs (KayKit, Kenney, Polygonal Mind). They animate more fluidly, but restyling them to our proportions and accessories would take as long, and their faces and outfits read as "asset pack".

## 12. Our own post-processing: ink from the depth buffer only

**Date:** 2026-11-11

**Decision:** One scene pass into a half-float target with a depth texture, then one full-screen pass that draws ink lines and grades color through a 24-point 3D lookup table, then (Medium and High) a tilt-shift pass that also adds paper grain, vignette and the Looking Lamp iris. Ink comes from the second difference of raw depth, which is zero on any flat surface at any angle, so flat ground stays clean while silhouettes and creases get lines. Samples snap to whole pixels, the bar rises with distance (depth precision), and the line wobble only runs on screens at least 1200 pixels tall.

**Why:** studied the idea in the reference project (depth-based outlines plus a LUT) and wrote our own. Skipping a normal buffer saves a full extra scene pass on phones.

**Alternatives considered:** a normal and depth pre-pass (better creases, about double the cost); inverted-hull outlines per mesh (doubles draw calls, poor on merged batches).

## 13. Quality tiers from simple device hints plus a frame watchdog

**Date:** 2026-11-11

**Decision:** The first tier comes from the GPU name, device memory, core count and whether the device is a phone. While the tier is automatic, a watchdog drops one tier after four slow seconds below 40 fps. It never raises the tier on its own. Players can pick a tier by hand (Settings in Phase 03, or `?quality=` in the URL).

**Why:** no extra download and no network lookup. The `detect-gpu` library fetches benchmark data from a CDN at runtime, which we avoid for privacy and offline play.

**Alternatives considered:** `detect-gpu` (network calls); a startup benchmark (delays the title).

## 14. World building: one merged mesh per material

**Date:** 2026-11-11

**Decision:** Still props are painted with vertex colors and merged by the `Batcher` into one solid mesh and one glow mesh per world. Only moving parts (the workshop's front wall and roof, globes, glass, characters, Milo) are separate. Small boxes use plain boxes, not rounded ones.

**Why:** the Home world draws in about 46 calls on Low (no shadows). Measured on an RTX 4050 laptop GPU: 180 fps at High (193 to 343 calls including the shadow pass). A true mid-range laptop and a real phone are still to be measured (Phase 07 performance pass).

## 15. Home layout choices

**Date:** 2026-11-11

**Decision:** Home planet radius 15. The house is drawn at 1.2 times model size so it does not look smaller than the workshop, which needs room inside for four kids and the camera. The workshop opens like a dollhouse: its front wall swings down and tucks into the ground, and its roof lifts away, when someone is inside. The dish antenna sits east of the workshop so no path crosses a building.

## 16. Globe maps and landing pins

**Date:** 2026-11-11

**Decision:** Desk globes use the NASA SVS CGI Moon Kit color map (1024 by 512, unchanged) and the USGS Astrogeology Viking MDIM 2.1 colorized mosaic (downscaled to 1024 by 512). Pins come from location facts in `facts.json`: `a11-site` and `a15-site` (NSSDCA Apollo Landing Site Coordinates) and `opp-site` (NSSDCA Opportunity page). `ing-site` stays `verify` until a NASA prose page gives the coordinates. Only the P0 pins (Apollo 11 and Opportunity) show now.

## 17. NASA model pipeline

**Date:** 2026-11-11

**Decision:** `scripts/assets/nasa-models.ts` downloads GLBs from `nasa/NASA-3D-Resources` (decoding Draco), welds, simplifies with meshoptimizer, drops textures (we paint with our toon material), quantizes and writes meshopt-compressed GLBs. Output goes to `.cache/` until a phase ships a model; then it goes to `public/models/` with a credit. First run: Ingenuity 4,174 triangles (81 KB), Opportunity 2,488 (40 KB), Voyager 28,120 (393 KB), Apollo Lunar Module 34,244 (524 KB). The Lunar Module and Voyager are still too heavy for our budget, so Phase 05 will likely rebuild them low-poly in code from NASA photos.

## 18. Browser tests that move the player use the Low tier

**Date:** 2026-11-11

**Decision:** Flow tests open `?test&quality=low`. `?test` exposes a small debug API (`window.__poh`) for state checks and for teleporting next to an interactable. It is also on in dev builds, and off otherwise.

**Why:** headless Chromium draws WebGL on the CPU at a few frames per second on High, which makes timed walks unreliable.

## 19. Keep the planet round under buildings

**Date:** 2026-11-11

**Decision:** Building pads are tangent planes sunk by half their rise (`padLift` in `worlds/home/layout.ts`), so a pad dips slightly at its middle and lifts slightly at its rim instead of standing up like a tabletop. Footings reach down under each building so no edge floats. The hill is a low rounded rise (height 1.7, radius 8.5) instead of a flat-topped mesa.

**Why:** the team said the top of the planet looked odd. Pads rising up to 0.5 units above the curve, plus a 2.5-unit mesa, broke the round silhouette.
