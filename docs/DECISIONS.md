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

## 20. Public URL on Cloudflare Pages: piecesofhome.pages.dev

**Date:** 2026-11-11

**Decision:** The team asked for a URL without the account's `workers.dev` subdomain. The game is now served by a classic Cloudflare Pages project, `piecesofhome`, at https://piecesofhome.pages.dev. Two Pages Functions (`pages/functions/parties/[[path]].ts` and `pages/functions/api/[[path]].ts`) forward co-op and API requests, WebSocket upgrades included, over a service binding to the `pieces-of-home` Worker, which still owns the `Room` Durable Objects. Static files on Pages are free and never run a Function. `npm run deploy` deploys the Worker, then Pages (`scripts/deploy-pages.mjs`).

**Notes:**

- `pieces-of-home.pages.dev` was already taken by someone else, so the project is `piecesofhome`.
- Wrangler 4.160 now sends `pages project create` to Workers by default; creating a classic Pages project needed `--force` once. Later Pages commands run normally.
- The Vite plugin's `.wrangler/deploy/config.json` redirect and the root `wrangler.jsonc` would both shadow the Pages config, so the Pages config is `pages/wrangler.json` and the deploy script parks the redirect file while Pages deploys.
- The old `pieces-of-home.tsa-bu.workers.dev` address still works (same Worker, same static assets).

**Alternatives considered:** renaming the account's workers.dev subdomain (changes every Worker URL on the account); a custom domain (costs money).

## 21. World and character pass before Phase 03

**Date:** 2026-11-11

**Decision:** At the team's request, a desktop-focused pass on world design, landscaping and characters before Phase 03. What changed and why:

- **Wind.** A new `foliage` batch layer carries a per-vertex sway weight (0 at the root of each shape, 1 at the tip). The toon shader bends those vertices with a slow lean plus a quick flutter, phased by position so the lawn ripples. One uniform drives it; reduced motion sets it to 0. Grass, flowers, canopies, the garden arch and the washing on the line all move, for no extra draw calls.
- **Detail layer.** Grass, flowers, pebbles and mushrooms use a `detail` layer that sways but skips the shadow pass. Their shadows were reading as dark specks across the lawn, and skipping them saves shadow draw time.
- **Fog on the far curve.** Fog distances count from the camera's horizon distance, so the haze sits on the planet's edge from any camera height. The wide orbit shot and the close follow camera both keep clean near colors.
- **Near-camera fade.** Toon materials dissolve with a 4x4 ordered dither when closer than about 1.7 units to the camera, so a bush or post the camera brushes past never fills the screen. Off for the ground.
- **Characters merged per joint.** Kids, Mom and props in hand are painted with vertex colors and merged per joint (`Assembly` in `actors/parts.ts`). Eyes and brows are joints of their own so blinking and brow lifts still work. Draw calls fell from 354 to 118 on Low and from 695 to 223 on High, even with Mom and many new shapes.
- **Characters.** Catch lights in the eyes, brows, a button nose, mitten hands with thumbs, rounded shoulders, cuffs and socks, sneakers with pale soles. Remi gets a side-swept fringe, cowlick and nape tufts, pocket flaps with buttons, and a fuller backpack (flap and buckles, a ringed-planet patch, a bottle and a rolled map in side pockets, a bedroll, a brass key charm) that swings on a damped spring when Remi runs and jumps. The workshop friends turn their heads to look at the player.
- **Mom (Game Bible 5.5).** A new actor seated on the porch bench with a mug of tea: sage cardigan, bob and round glasses, a folded letter in her pocket. She sips now and then, watches the player when they come near and waves once each time they walk up.
- **Landscaping and story props** (`worlds/home/yard.ts`): porch steps and a lattice skirt, Remi's bike on the porch rail, a covered woodpile with an axe, rain barrels, a washing line with a basket, a hydrangea bed; sawhorses with a half-built birdhouse, a board stack under a tarp, Dad's cable to the dish on a pole, a solar panel, an old wheel and a crate of jars; a rose arch over the garden gate, Dad's tin-can scarecrow robot with pie tins, stacked pots and a wheelbarrow; a rebuilt hilltop telescope (tripod with spreader, mount, finder, dew cap) beside a bench with a star chart, paper planes and a lantern.
- **Nature.** Trees are planned before the ground is painted, so the grass darkens under each one. Hero trees frame the yard (a big oak, an autumn maple, a birch grove, an apple tree with windfalls, pines); the far side is wilder woods. Canopies are a dark heart, a lumpy ring and bright top blobs. Background trees use lighter spheres. Mushrooms at tree roots, moss on rocks, grass gathered at edges, wildflowers in single-color drifts with ten-point heads.
- **Smaller fixes.** A lamp post that stood on the porch deck is gone; terrain detail is higher on Medium and High so near slopes stop showing facets; the chimney smokes.
- **Screenshots** are desktop only (1440x900) for this pass, at the team's request (`scripts/screens.ts ... desktop`). New gameplay bookmarks `play-yard`, `play-garden`, `play-shed`, `play-hill`, `play-meadow` stand the player in place with the normal follow camera, plus a `mom` close-up.

**Budget after the pass:** Low 118 calls and 240k triangles; High 223 calls and 608k triangles (every pass included). Phase 07 measures a real mid laptop and phone.

**Alternatives considered:** instancing grass and flowers (more code paths, and the merged batches already draw in one call each); alpha-blended near fade (needs sorting, breaks the depth-based ink).

## 22. Phase 03 type system and the taste skill

**Date:** 2026-11-11

**Decision:** Three self-hosted open fonts, latin subsets only, from `@fontsource` (dev dependencies; the woff2 files and their OFL texts live in `public/fonts/`):

- **Kalam** (400, 700) for Dad's handwriting, the kids' notes, headings and buttons. Warm, readable at small sizes, not a novelty script.
- **Atkinson Hyperlegible Next** (variable) for reading text. Built for low-vision readers; its slashed zero and open shapes help young readers too.
- **Zilla Slab** (500, 700) for museum tags, stamps and labels.
- **OpenDyslexic** (400, 700) as the optional reading font.

Kalam is preloaded on the loader so the first paint is already in Dad's hand. The taste skill (tasteskill 2.5.1) is written for company websites: its dealers, section plans and gate expect a marketing page. We applied its general rules (one system of tokens, real photos with exact credits, plain copy, hover and press micro-motion, no generic fade-ins, no purple gradients or glass) rather than its site generator, which does not fit a game UI.

**Alternatives considered:** Patrick Hand or Caveat for the hand (thinner, harder to read at 15 px); Lexend for reading (good, but Atkinson's legibility research suits the audience better); the system UI stack (banned by the phase prompt for display text).

## 23. Loader built at build time, progress from real work

**Date:** 2026-11-11

**Decision:** The loader is inline HTML and CSS in `index.html`, filled in by a Vite plugin (`scripts/vite/loader-plugin.ts`): the lamp is five SVG strokes in three hand-wobbled copies (a 3-frame boil at about 10 fps), and the "Things that kept working" lines come from each fact's new `short` wording, so `check:facts` covers them. `BootProgress` (`src/boot/progress.ts`) weights real tasks (engine, world build, textures through a `LoadingManager`, audio prepare, fonts, UI mount); nothing moves unless its work does. Slow loads (8 s) show a note and a percentage, no WebGL shows a paper note linking to the Field Guide, reduced motion drops the boil and the curl for a cross-dissolve. A gamepad button also turns on the light; since a pad press is not a browser gesture, the audio engine retries its unlock on the next click or key.

**Intro switches:** `?test`, `?shot` and `?skip` skip the loader wait and the title (tests and bookmarks need the game at once); add `?intro` to run the real intro in tests.

**Alternatives considered:** a Svelte loader (paints only after the bundle loads); a fake timed progress bar (dishonest, and the prompt says real progress).

## 24. Title sequence on wall-clock time

**Date:** 2026-11-11

**Decision:** `TitleSequence` (`src/game/title/`) owns the camera from the loader to the menu: a straight dolly back from Dad's lamp, out through the open workshop door with the lamp still centered, then up and over the planet. The block letters are our own 5-row grid alphabet, traced into outlines with rounded corners and extruded with a bevel (wood sides, cream and amber faces). Every glyph joins its cells by edges, never only by corners, so each letter is one piece. The title stands in front of the planet with its baseline on the horizon as seen from the final camera, which is aimed above the planet so the sky holds all three lines. The O in HOME is a glass bulb with a coiled filament; the BEGIN tag hangs on a beaded pull chain that springs back. An accessible button rides over the tag (drag, click, tap, Enter or gamepad A). The sequence uses wall-clock time capped at 0.25 s per frame, so a slow machine sees the same 7-second flight, not slow motion.

Dad's desk lamp was rebuilt for the opening close-up: weighted base, twin lower arm, enamel shade with a brass rim, and an always-lit bulb, shade lining, halo and light pool, so it glows while the rest of the planet is still dark on the title.

**Alternatives considered:** a flight out through the side window (the window panes are opaque batched glow, which hid the lamp); a 2D title over a screenshot (loses the bulb and chain that belong to the world).

## 25. Field Guide and About as static pages

**Date:** 2026-11-11

**Decision:** `/field-guide/` and `/about/` are plain HTML pages built by a Vite plugin (`scripts/vite/pages-plugin.ts`) from the same notebook, fact, image and credit data as the game, as extra client entries in `vite.config.ts`. No WebGL and no bundle: one stylesheet, one tiny inline script that swaps the Voyager light-day wording on the day it comes true. Dad's sketches are drawn at build time with rough.js (it needs no DOM). Every fact carries a numbered source link, every photo its exact credit line; the print sheet hides navigation, drops color and prints each source URL. The About page holds the "For grown-ups" note from Game Bible 5.9. Player-facing pages and the menu do not name the challenge; the NASA disclaimer lives in Credits and in the two page footers (team request).

**Alternatives considered:** a Svelte route inside the game bundle (slow on old machines, and it would load Three.js); a separate static site (two copies of the content could drift apart).

## 26. Gamepad for the 2D screens

**Date:** 2026-11-11

**Decision:** One `gamepadNav` helper (spatial focus moves on the D-pad or stick, A clicks, B goes back) runs on the title, menu, panels and emote wheel from `App.svelte`, and inside the notebook (LB and RB turn pages). In play, View opens the notebook, LB takes a photo, Y opens emotes and Menu opens settings; the HUD stamps show those glyphs when a pad is in use. A Playwright test drives the whole front door with a pretend pad.

**Alternatives considered:** mapping the pad to fake key events (loses spatial focus and the A-means-click rule).

## 27. Unit tests run from the canonical path

**Date:** 2026-11-11

**Decision:** `npm run test` runs `scripts/vitest.mjs`, which starts Vitest from an upper-case drive path. When a Windows shell hands Node a lowercase `c:` path, Vitest loads itself twice and every suite fails with "reading 'config'". Pure settings logic moved to `src/ui/settings-data.ts` so it can be tested in Node.

**Alternatives considered:** telling every teammate which shell to use (easy to forget).

## 28. Warm cards and dusk glass for the 2D layer

**Date:** 2026-11-11

**Decision:** Every control drawn over the world (HUD tools, prompt, goal card, tips, menu list, notebook bar) uses one dusk-glass style: deep indigo at 60 to 78 percent, a light blur, cream text and amber accents. Paper surfaces (the notebook, panels, the Field Guide) stay warm cream cards. The notebook was rebuilt as real spreads: a contents page with dotted leaders, a machine spread per letter (Dad's nickname in his hand, the real name, his sketch marked "Model, not to scale", his note on lined paper; then polaroids with exact credits, sourced facts, a "Then and now" label and Deeper notes), envelopes that get a wax seal and a Delivered stamp, and a page that lifts and turns with a shaded back face. Phones slide pages instead of flipping them.

**Alternatives considered:** paper tabs for the menu over the 3D world (hard to read at dusk); a single-page notebook (loses the turn of a real book).

## 29. One goal at a time, and tips that end when you do the thing

**Date:** 2026-11-11

**Decision:** A goal card (top left) always shows exactly one next step, where it is and why, with step dashes and a short "Done!" when it is finished (`src/content/goals.ts`). A chapter card names the part of the story when play begins. How-to tips teach one control at a time (move, look, the paper arrow, use, notebook) and each one ends when the player actually does it, not when they press OK. Tips can be hidden and shown again from Settings. The Hint tool repeats the goal's longer hint. Story flags (`GameState.flags`) record beats such as opening the notebook.

**Alternatives considered:** a modal tutorial before play (kids skip it and then are lost); always-on control hints (clutter).

## 30. Home: a round little planet with places all the way round

**Date:** 2026-11-11

**Decision:** The team found the planet lumpy and too crowded. The ground noise dropped to 7 cm and every loose bump was removed; only a low, wide hill remains, so the silhouette is a clean circle from any side. The home lot (house, workshop, garden, dish, hill, meadow) keeps the title framing but each building has more room. Nine places to find are spread over the rest of the sphere, each with its own pad, keep-out zone and footpath: the treehouse, the playground, Lily Pond with a dock and rowboat, Campfire Camp, Dad's weather station, the windpump, Rocket Field with Dad's model rocket, the orchard with beehives, and a tethered balloon at the south pole. Moving parts (fire, anemometer cups, wind vane, windsock, swings, windpump wheel, kite, balloon) are batched separately and turned each frame. Walking into a place shows its name; the first visit shows "New place found", one line and a dot per place, and the Explore goal counts places found (`src/content/places.ts`). All of it is procedural geometry, so there are no new assets or credits.

**Alternatives considered:** a bigger radius (more walking, less tiny-planet charm); more props on the front face (more crowding, the complaint we were fixing).

## 31. Footpaths as ribbons, not painted ground

**Date:** 2026-11-11

**Decision:** Paths painted into the planet's vertex colors took the mesh's stair-step edge and looked like orange roads. Paths are now their own ribbon mesh (`worlds/home/paths.ts`): smooth curves sampled every 28 cm along trails that bow and bend (flat at the ends, so they leave a door or junction straight), a nearly flat pale track with a thin soft rim that the ink pass outlines, edges that wander a little in width, round patches where trails meet or end, pebbles just off the edge, and flat stepping stones up to the porch. The grass beside a path is painted slightly worn so the track settles in. Distance checks skip far arcs with one dot product, so the many short arcs cost little at load.

**Alternatives considered:** a decal texture (needs UV work on a sphere and another texture); keeping vertex colors with a denser planet mesh (many more triangles for the same edge).

## 32. Limbs as true capsules with knees and elbows

**Date:** 2026-11-11

**Decision:** Short capsules stretched along one axis became squashed balls, which made arms and legs look like beads. `limb()` in `actors/parts.ts` builds an even-radius capsule between two points. Kids and Mom have thigh and shin, upper arm and forearm segments with knee and elbow joints, so walking lifts the knee, running bends the elbows, landing squashes into the knees, and the torso counter-twists.

**Alternatives considered:** skinned meshes (a rig and a modeling pass for four kids and Mom, for little gain at this size).

## 33. Keep the 2D layer responsive when the 3D world is slow

**Date:** 2026-11-11

**Decision:** When the notebook or a panel covers the world, the engine redraws the frozen world only now and then if a render takes longer than 40 ms, so a slow device keeps the notebook and its gamepad controls smooth. Menu gamepad input is polled on a 40 ms timer instead of once per frame, so a press is never missed between two slow frames. The gamepad test lets the page time each press itself, so a slow test runner cannot turn a tap into a held, repeating D-pad.

**Alternatives considered:** pausing rendering entirely under overlays (the world behind the scrim would never update after a resize).

## 34. The loader is Dad's notebook, open on his workbench at night

**Date:** 2026-11-11

**Decision:** The team found the first loader plain and generic, so the opening is now a scene. Dad's leather notebook lies open on a walnut bench, lit by moonlight through the workshop window. On the left page his sketch of the lamp draws itself as the game loads, his notes appear beside each part, and a doodled map shows letters travelling from home to the Moon and Mars. On the right page the title is set in hand-inked block letters (the O of HOME is a bulb), a postmark is stamped in the corner, and a pencil ticks off "Things that kept working". Round the book sit a mug, two letters addressed to the Moon and Mars, a ruler and a few of Milo's spare parts. "Turn on the light" is an ink stamp. Pressing it flicks the lamp on: the moonlight leaves, the bench turns warm, and the light grows from the sketch's bulb to fill the screen. Everything is inline SVG and CSS drawn by us and built into `index.html`, so it shows before any script runs. On phones the book becomes a top-bound sketchbook with two stacked pages.

The loader is kept cheap so it never slows the game loading underneath it: shadows switch at once when the lamp turns on (a real lamp does that anyway), the light is a soft burst and a fade that only change transform and opacity, the sketch boils at about 5 frames a second, and nothing else moves. While the paper covers the canvas, the engine draws the 3D world a few times to warm up and then waits until the light is turned on. A gamepad direction held through a slow frame starts its repeat wait again, so one press never jumps two places. Together these halved the time of the local Playwright run.

**Alternatives considered:** a 3D desk scene (needs the 3D engine before anything shows, against the instant-paper rule in Game Bible 10); a downloaded illustration pack (none matched the art direction, and the drawing is the story).

## 35. The main menu is a row of index tabs in Dad's notebook

**Date:** 2026-11-11

**Decision:** The amber pill and dusk-glass list read as a generic app menu and broke the Game Bible's "never glassmorphism" rule. The menu is now Dad's notebook peeking in from the right edge of the screen, with each choice a paper index tab sticking out of its pages (Game Bible 10, item 7). Each tab has its own paper colour, a doodle in Dad's hand (a sealed letter, two kids holding hands, a magnifier over a leaf, a wrench, a heart) and a Kalam label. The first tab is the big one, with a short line under it ("Dad's letters are waiting" or "Pick up where you left off"). Hover or focus slides a tab out and a pencil arrow points at it. Starting again over a save asks on a note taped over the page, with a stamp to confirm and Escape to cancel. The 3D title now shrinks about its baseline on tall phones, so every letter fits the screen.

**Alternatives considered:** a full open notebook page with a written list (hides the planet, which is the best thing on screen); keeping the pill and restyling the list only (still reads as an app).

## 36. One paper language for every 2D screen

**Date:** 2026-11-11

**Decision:** The team found the panels, HUD and notebook generic. Every 2D surface now follows Game Bible 11 literally. Panels are sheets of Dad's notebook paper taped over the world, titled in Kalam with a pencil underline. HUD tools are postage stamps (the game is about letters) with their keys on round stickers. The use prompt is a paper tag with a drawn key cap. The goal is a note pinned in the corner with drawn step boxes. Tips are a taped card with W, A, S, D laid out like real keys, or a drawn mouse, stick or finger. Places hang on a swinging paper tag. Buttons, switches, sliders, tabs and selects share one style: an ink outline with a hard offset shadow, like a cut-out sticker. Fraunces and every frosted-glass surface are gone; Kalam leads, Atkinson stays for reading, Zilla Slab for stamps and tags. With the dyslexia font on, Kalam headings switch to the reading face.

**Alternatives considered:** keeping the dusk-glass HUD for contrast over the world (the Bible rules out glassmorphism, and paper with an ink outline reads just as well over any background).

## 37. A short storybook before a new story

**Date:** 2026-11-11

**Decision:** New story now opens with six of Dad's drawings that ink themselves in, each with one or two short lines: Home, the workbench, the workshop door, the letters, Milo in pieces, and the plan. It says plainly that Dad died (Game Bible 5.9), then turns to the task. Pages turn on their own after time to read (a base plus a little per word), and Next, a click, a tap, a key or the pad turns them sooner. Skip story, Escape and gamepad B skip it. Captions are live text and are read aloud when that setting is on.

**Alternatives considered:** an in-engine camera cutscene (slower to load, harder to read, and the notebook drawings are the game's voice); a video (weight, and no captions by default).

## 38. The loader's prompt is a light switch; the title gets ink outlines

**Date:** 2026-11-11

**Decision:** "Turn on the light" is now a drawn wall switch with a chunky lever that nudges up while it waits, inside a pulsing warm ring. Everyone knows what to do with a light switch. The 3D title letters get a thick ink outline (an inverted shell on each block) so they read against the dusk sky, and the BEGIN tag is bigger with a pulsing ring and a paper "Pull the chain" label.

## 39. Hair from locks, bodies with shape

**Date:** 2026-11-11

**Decision:** Hair was a sphere cap that read as a helmet. Each hairstyle is now built from overlapping teardrop locks (`hairLock` in `actors/parts.ts`), with a slightly lighter shade where the light catches. The top is a lathe with soft shoulders and a hem, and a rounded seat joins the legs to the body. Everything still merges into one mesh per joint.

**Alternatives considered:** modeled glTF characters (a modeling pass for five people and a skinning rig, and the procedural kids already animate well).

## 40. Smoother play on slower machines

**Date:** 2026-11-11

**Decision:** A resolution governor draws fewer pixels when play drops under 50 fps and wins them back above 58, before the watchdog drops a whole tier. The frozen world under the notebook and panels redraws at most ten times a second. The opening's shaders compile while loading, so the light switch answers at once. Looping UI animations only move by transform. Jumps forgive a late or early press by a fraction of a second, the camera lets a jump rise in front of the lens instead of bouncing the view, the mouse wheel zooms, and the lens opens slightly while running.

## 41. Desktop screenshots only; more air in the loader title

**Date:** 2026-11-11

**Decision:** Review screenshots are captured and kept at 1440x900 only. The 390x844 phone captures were deleted from `docs/screens/`, and `scripts/screens.ts` and `scripts/screens-intro.ts` no longer take them. CLAUDE.md and the Phase 07 prompt say so. The loader's pen-drawn title gets wider letter gaps (1.3 cells instead of 0.8), a taller line gap, more room before "Things that kept working", and a little letter and word spacing on that heading.

**Why:** The team asked to drop the phone screenshot process and focus review on the desktop view, and said the title's letters and words almost touched.

**Alternatives considered:** Keeping phone captures but not reviewing them (wasted time and repo weight). The game still lays out and plays on phones; only the screenshot review changed.

## 42. Phase 04 audio: raw Web Audio, per-step feet, a look-ahead score

**Date:** 2026-11-11

**Decision:** All sound is synthesized with the raw Web Audio API, with no Tone.js and no ZzFX. The Audio Director (`src/audio/audio.ts`) owns one AudioContext, six buses (master, music, ambience, effects, voices, ui) through a gentle compressor and a limiter, a synthesized convolution room on Medium and High (a soft echo on Low), voice ducking of about 5 dB and the notebook muffle (a lowpass that slowly closes on ambience and effects). Cues are registered by name with volume, random pitch and loudness, a minimum gap and a voice limit. Positional emitters use PannerNodes (HRTF on High, equal power on Medium, distance-only mono on Low) with the camera as the listener. Ambience beds are computed in plain JavaScript while the page loads, loop without a seam, and crossfade by where the player stands. Footsteps are synthesized per step from the controller's stride events, by surface. The score is a look-ahead scheduler on the audio clock: world and harmony changes wait for the bar line, layers fade on slow curves, and there is one extra instrument per co-op friend (bells, plucks, a counter-melody). Voices are one continuous formant-filtered oscillator per line, with the pitch shaped by punctuation. Dad's lines play `/audio/vo/<line>.ogg` when it exists and his hum otherwise. An audio lab page (`/audio-lab/`) lists every cue and measures each offline.

**Why:** Raw Web Audio keeps the bundle small (Tone.js is about 300 kB) and gives exact control of envelopes so nothing clicks. Per-step footsteps line up with the feet better than a synced loop on a small planet where pace changes often. Beds made ahead of time cost nothing per frame, so audio holds the frame rate on Low.

**Measured:** Offline renders of every effect and voice peak between -8 and -36 dBFS with no unintended clicks (the only large sample jumps are the deliberate switch, shutter and snap transients). Live music peaks stay between -11 and -18 dBFS in every world.

**Alternatives considered:** Tone.js for the music (heavier, and its Transport would duplicate our own clock). A synced footstep loop as in Messenger (felt loose on the curve of a tiny planet). Recorded samples (would need licensing and grow the download).

## 43. Hair as one sculpted shell

**Date:** 2026-11-11

**Decision:** Each character's hair is one parametric surface (`src/game/actors/hair.ts`): a shell a little larger than the head that follows a hairline, splits into locks with soft grooves, ends in pointed or rounded tips, can sweep its fringe, hang straight (bobs), curl, or tilt its crown for a side parting. A thin inner surface gives the edge thickness. Per-vertex paint adds a light band where the lamp light catches the crown and darkens the underside. Remi, Nori, Lumi, Theo and Mom each have a style; the overlapping lock blobs from DECISIONS #39 are gone, except Remi's single cowlick.

**Why:** The team asked for smoother, better hair. Stylized game characters model hair as one sculpted mass with grooves, not as separate blobs; one smooth surface has no seams, takes the ink outline cleanly, and costs fewer triangles than twenty-five lock spheres.

**Alternatives considered:** Metaballs or marching cubes (heavier to build and harder to art-direct), hair cards with textures (does not fit the painted toon look), more locks (more seams and triangles).

## 44. Space mail, postal stamps and mission patches in Dad's notebook

**Date:** 2026-11-12

**Decision:** Dad's letters are airmail envelopes ("By lamplight", a clay and night-blue edge, a perforated postage stamp engraved for the destination, an amber wax seal with the lamp, a round postmark once delivered). Chapter stamps are round post-office cancellations (`InkStamp.svelte`). Each machine has an embroidered mission patch of our own design (`MissionPatch.svelte`); the notebook's first page carries the notebook's patch on a paper ribbon, the contents show each machine's patch (pencil circle until earned) and a coloured destination tag, and the stamp moment lands on a sheet of Dad's paper with the patch flying in after. Dad's handwriting moves to a deeper fountain-pen blue-black (`--dad-ink: #233f73`), page numbers to red pencil, and labels get a small star.

**Why:** The team asked for a better mail and stamp design, better notebook type and colour, and a stronger space feel. Patches, airmail and cancellations are the real visual language of space missions and of post, so they carry both the delivery story and the space theme without any agency marks.

**Alternatives considered:** A bookplate and rectangular rubber stamps (the previous design, too generic), NASA-style logos (not allowed), photographic stamps (would look like real artefacts).

## 45. A mission layer across the game

**Date:** 2026-11-12

**Decision:** Added Game Bible section 7.1, the mission layer: what is built now (patches, space mail, cancellations, the "Your mission" tab, the backyard dish listening to stars and static) and what Phase 05 builds next, each idea tied to a game that does it well (a lamp countdown with a co-op "Go!" poll, a gentle landing, light-delay signals, hand-drawn telemetry gauges, a rover-camera photo frame, a clue string, a mission timeline). The player never sees the name of the challenge, and every number still comes from `facts.json`.

**Why:** The team asked for the game to feel more like a space program, in idea, design and play, with other games as reference, without naming the hackathon.

**Alternatives considered:** A sci-fi restyle (would lose the warm, handmade tone), real mission logos (not allowed), timed challenges (against the no-fail pillar).

## 46. Chapters as typed data, played by a story director

**Date:** 2026-11-12

**Decision:** Each chapter is one typed file in `src/content/chapters/` (arrival, Dad's tag, three letters with their beats, the activity, Milo's part, the memory and the stamp). Scripts are lists of lines: speech, Dad's note cards, fact cards (a fact's own kid wording from `facts.json`), pauses and real mission recordings with captions. A story director (`src/ui/story/director.ts`) plays them and moves the chapter on; one function, `chapterStep`, decides where a save stands, for the goal card, the paper arrow and the story alike. Cards wait for the player ("Got it", E, Enter, Space or the gamepad's A), and while one is up the interact key belongs to the card. The fact check now also counts `fact: "id"` in script lines.

**Why:** Copy stays in one place per chapter, ready for a Filipino version later, and the game never has two opinions about what comes next. Cards that wait respect the no-timer pillar and every reading speed.

**Alternatives considered:** All strings in one JSON file (harder to read beside the beats they belong to; a locale layer can map the same ids later), cards that close on a timer (rushes slow readers).

## 47. Chapter 1: Tranquility Base and Send a Light

**Date:** 2026-11-12

**Decision:** The Moon world keeps the real site's arrangement, squeezed: the descent stage in the middle, the flag and the TV camera to the north-west, the moonquake listener and the little mirrors to the south, Little West crater to the east, boot prints between them. Dad's practice corner, two spare mirrors on easels and an Earth console stand apart, so the activity never touches the model of the real things. Earth hangs low (12 degrees) behind the corner, so it stays in view. The activity uses real ray math (`src/game/puzzles/optics.ts`): one mirror bounces the light away, two still miss, three in a corner send it home from every turn of the frame; the corner's twist was chosen by a unit test that checks exactly that. The pulse takes the sourced round trip (`light-roundtrip`), with a short camera move so the player sees it reach Earth, then all hundred cubes glint.

**Why:** The Game Bible asks for the insight to come from play: the beam visibly misses until the third mirror, and turning the frame proves the trick. Low Earth keeps the beam and the planet in one frame.

**Alternatives considered:** Earth high overhead as at the real site (off screen in a follow camera), a flat mirror the player can aim (teaches aiming, not retroreflection), a fake beam that always returns (not honest).

## 48. Milo's parts come home as parcels

**Date:** 2026-11-12

**Decision:** When a chapter's activity is done, a parcel with Milo's name waits by Dad's tag. Remi carries it home through the Looking Lamp and gives it to Milo on the workbench; the part clicks in, Remi remembers, and the stamp lands in the workshop. Domes on the workbench take you into each world after a "3, 2, 1" lamp countdown, glow once their stamp is earned, and the next one breathes softly.

**Why:** It reuses the core verb (carry and deliver) for the biggest moment of each chapter, and it makes the workshop change after every chapter, as the Game Bible asks.

**Alternatives considered:** Fitting the part inside the chapter world (Milo would have to travel before he has wheels), an automatic upgrade (no moment of giving).

## 49. Recorded sound on top of the sounds made in code

**Date:** 2026-11-12

**Decision:** A subagent sourced 72 short files (about 1.46 MB): Kenney's CC0 footsteps, pages, cloth and clicks; single notes of a real piano, harp, ocarina, glockenspiel and hand chimes from the CC0 Versilian Community Sample Library, retuned to within 3 cents; and four NASA mission recordings. `src/audio/samples.ts` loads them after the first click. Footsteps and paper sounds play a different take each time with a little pitch drift; the score plays each note from the nearest real sample; the code-made sounds play until the files arrive and still layer under a few cues. Every take was measured offline in the audio lab and its gain set to match the loudness of the sound it replaces. Speech babble now follows the real words, one syllable per vowel group, with each letter nudging the pitch the same way every time (the trick Animal Crossing's voices use). Chapter 1 plays the real "Tranquility Base here. The Eagle has landed." with a caption and a sourced fact card. The credits list the recordings one by one and the sample packs by name.

**Why:** The team asked for better audio in everything, using modern games as reference or real recordings. Round-robin foley and sampled instruments are what modern games use; real mission audio is the most honest sound this game can play.

**Alternatives considered:** Only synthesis (thin next to real takes), large commercial libraries (licences not allowed), streaming music (size, licences).

## 50. Fact check results shape the design

**Date:** 2026-11-12

**Decision:** 21 of 22 open facts are checked. `opp-quote-myth` could not be confirmed by NASA or JPL, so Chapter 3 drops both the quote and the myth and shows only the rover's last data. `sur3-microbe` is now unverified (NASA sources disagree), so the bonus chapter will not mention it. `lrv-rear-steer` is confirmed, so Chapter 2 may say the first drive steered with the rear wheels. The Voyager 1 light-day moment is 10:16:07 UTC (NASA), not 06:16:07 UTC, and the notebook and field guide now switch their wording then. `mars-blue-sunset` is allowed only for the sky near the Sun.

**Why:** Every claim a player sees must have a primary source.

**Alternatives considered:** Rewording unverified claims more vaguely (the rules say remove, not soften).

## 51. Short cinematic camera moves

**Date:** 2026-11-12

**Decision:** Game code can ask for a short camera view (`camera:cinematic`). The engine eases it in over the follow camera, holds, and eases back out, so the player never loses their place. Used for the pulse flying to Earth and the glint of the hundred cubes. Under reduced motion the ease is quick.

**Why:** The two best moments of Chapter 1 happen away from where the player stands.

**Alternatives considered:** Fixed cutscenes (take control away), leaving the camera alone (the payoff happens off screen).

## 52. Chapter 3: Wait for the Wind, played with breeze flags

**Date:** 2026-11-12

**Decision:** Meridiani Planum is a 14 m Mars world: butterscotch plains with dark sand ripples, Eagle crater with the lander and its limp airbags, the trail of airbag bounce marks rolling into it, wheel tracks painted from the crater to Opportunity, and a layered outcrop with blueberries. The activity: the rover sleeps under a dust film (one transparent material whose opacity is the dust). Dust devils travel the same lane past the rover every ten seconds. Each planted breeze flag pulls a passing devil toward it (real steering on the sphere, `src/game/puzzles/wait-for-wind.ts`), so a line of flags bends a devil over the panels; the dust blows off, the power gauge fills, the mast lifts and the eyes light. Nothing can fail and another devil always comes. Then the story cues the long storm: the sky, fog, grade, sun and dust thicken over about six seconds, the music thins and goes silent while Remi sends calls nobody answers, then it clears and the rover stays asleep. Three small story games carry the rest: grinding a rock to find blueberries, the rover's last report as two wordy gauges (no numbers), and the calls. The real Mars wind (Perseverance) plays as a looping bed under the made ambience, louder in the storm.

**Why:** The Game Bible asks for solar power, dust and lucky winds, rocks that remember water, and room for the sad part. Flags give kids a physical way to "help the wind" without wiping panels, which nobody could do on Mars.

**Alternatives considered:** A wipe minigame (untrue to the story), a timed wind button (no play), quoting the rover's "last words" (unsourced, DECISIONS #50).

## 53. Dad's map: a corner map and a globe to spin

**Date:** 2026-11-12

**Decision:** Every world can carry a `map` (marks with hand-drawn glyphs, craters, water, paths, letters). The corner map (bottom left) shows the ground round Remi from above, with true distances and the camera's view up the page, the next stop as a ring or a rim arrow, and envelopes where letters wait. Clicking it, M, or LT opens the big map: the whole little world as an orthographic globe that spins by drag, arrow keys or the place list, opens on the middle of Dad's places and zooms to fit them, with labels placed so they never overlap. Home places stay pencil question marks until found. A setting turns the corner map off. The projection math is unit tested (`tests/unit/map.test.ts`).

**Why:** The team asked for a mini map that opens into a whole map as a guide on each planet. A globe suits tiny round worlds better than a flat chart, and a heading-up corner map matches the third-person camera.

**Alternatives considered:** A flat equal-area chart (the far side tears at the rim), two hemispheres (the seam confuses), a 3D render-to-texture map (cost and noise).

## 54. Front end polish from team review

**Date:** 2026-11-12

**Decision:** On the loading page the pencil now rests beside the last tick instead of over the closing line, and the light switch holds still under the pointer. On the title, the button, its outline and the "Pull the chain" note sit over the tag's rest position; only the chain and tag swing. In play, the big cards take turns: the chapter card holds the stage until it has faded, a place card waits (or steps aside) until then, and both cards are smaller. The chapter card now names the chapter of the world Remi arrives in instead of always saying Prologue.

**Why:** Team feedback on screenshots: hidden words, moving targets, and two large cards covering the screen at once.

**Alternatives considered:** Hiding the place card at the start (players lose the first find), merging both cards (two different messages).

## 55. A word-aware murmur for the speech bubbles

**Date:** 2026-11-12

**Decision:** The characters' murmur is rebuilt as a small formant voice (`src/audio/voices.ts`). Each line is planned word by word: content words carry stress, short gaps sit between words, commas and full stops get real rests, questions rise and statements fall, and the first letters of each syllable shape a soft consonant (a stop, a hiss, a hum or a glide). A tilted throat wave feeds four parallel formant filters, widened for higher voices so no vowel goes thin, with a little chest warmth and presence. Dad keeps his closed-mouth hum, Milo keeps his bleeps. Levels match the old mix within about a decibel, and lines run close to the bubble's typing.

**Why:** Team feedback asked for a better murmur. The old one was one buzzing tone per syllable with no words or pauses, so every line sounded the same.

**Alternatives considered:** Recorded gibberish samples per character (download weight and a license for each voice), speech synthesis (real words clash with the captions and vary by device).

## 56. Corner map as a compass, and a calmer globe

**Date:** 2026-11-12

**Decision:** The corner map sits in a paper compass bezel with tick marks and a red N badge that turn with north, and the ground glides with Remi every frame: it is laid out once round an anchor point and only slid and turned until Remi wanders 1.5 m away. The big map keeps its zoom and spin controls on the globe (round + and - buttons, a compass that shows north as the globe spins), eases between zoom steps, keeps every pin and label wholly on the globe, rings a place on the globe while the list points at it, and heads the list with "n of m found".

**Why:** Team asked for a better map design and placements, and a smoother feel. The old corner map redrew ten times a second, which read as stepping.

**Alternatives considered:** A north-up corner map (fights the third-person camera), a canvas-drawn corner map (loses the crisp SVG ink and its accessibility hooks).

## 57. Smoother frames: horizon culling and shaders ready before they show

**Date:** 2026-11-12

**Decision:** The world props and the planet ground are cut into 16 wedges by direction (`Batcher.build` with `sectors`, `planetMeshes`), and every frame the engine hides each wedge that sits wholly behind the curve of the planet as the camera sees it (a conservative sphere-behind-sphere test, unit tested). Triangles drawn fall by about 45% on every world (Home low tier 333k to 180k, high 877k to 504k) for about 20 more draw calls. Every shader the world could use, hidden props included, is compiled at boot and again behind the closed iris after each trip, and production builds stop asking the driver about each shader (that question stalls until compiling ends). Panels now lift away and fade when they close instead of vanishing, and the map queries reuse their vectors so the corner map makes no garbage.

**Why:** Team asked to optimize the game and make it smoother. On a tiny planet half the world is always behind the horizon but was drawn anyway, in every pass, and first-time shader compiles caused hitches when walking near new things or arriving in a new world.

**Alternatives considered:** Lower detail everywhere (worse look), GPU occlusion queries (latency and driver cost), smaller instanced batches per prop type (far more draw calls).

## 58. A foldable mission note and a travel screen between worlds

**Date:** 2026-11-12

**Decision:** The mission note in the top left folds down to its tag, step boxes and the goal's title (a round chevron button on the note, or J), and remembers the choice. When a new goal arrives while it is folded, it opens by itself for a few seconds (after any travel screen lifts) so the change is still read. Every trip through the Looking Lamp now shows a travel screen over the closing iris: a night sky, the world left behind and the world ahead drawn as little planets, and the lamp's light drawing a pencil route between them, with the destination's name ("Tranquility Base, On the Moon", "Home, Back to Dad's workshop"). The light eases most of the way while the world loads and finishes once it is ready; the screen holds at least about two seconds so a trip reads as a trip, and says "Almost there..." on a slow load. The new world's story, its chapter card and place cards wait until the screen lifts, and Remi stands still under it.

**Why:** Team feedback: the mission note covered too much of the screen, and changing chapters or planets needed a proper transition instead of a quick blink of the iris.

**Alternatives considered:** Hiding the note after a timeout (players lose the goal), a progress bar loading screen (reads as software, not story), a 3D flight between worlds (load cost, and it would delay the trip on slow devices).

## 59. Finale: The Long Light

**Date:** 2026-11-12

**Decision:** The Finale opens on Home once every built chapter has its stamp (`src/content/finale.ts`, one `finaleStep` decides the goal card, the arrow and the story). A "Finale / The Long Light" card shows, night falls over a few seconds (sky, grade, fog and lights blend to the Finale navy), Mom says the mailbox flag is up again, and the mailbox holds Dad's last letter, "To Voyager 1, far from home". At Dad's dish the star map opens (`DishGame.svelte`): the real bright stars round that patch of sky (Yale Bright Star Catalog at NASA HEASARC) and Voyager 1 hidden at its real place for today (JPL Horizons). Turning the dish by drag, keys or stick changes the radio from static to beeps, faster as it gets close; close enough, it locks on and Voyager 1 lights up. Sending the letter draws a dotted signal and the map says how long light would take today ("about 23 hours and 59 minutes" on the build date), with its source. The facts follow (launch, interstellar space, the date-aware light-day line, the Golden Record). Milo's record waits in the dish's little box; it clicks into Milo (stage 5), Milo plays Dad's saved messages (always labeled "Dad (saved message)", with captions) and then projects the photos Remi took, or the stamps if there are none. The notebook's last page asks "What will you discover next?": a group photo, a favorite-discovery sticker, and a next-adventure name from word chips (no typing; it stays on this device). Then Dad's last note, the stamp NOT LEFT BEHIND. STILL SENDING., a closing picture, a credits roll built from the facts' sources and the credits file, and free roam with the workshop as a museum. The light-day fact now gives today's light time from the Horizons table after the milestone. A full playthrough test covers it (`tests/e2e/chapters.spec.ts`).

**Why:** The Finale is the last P0 piece (Game Bible 5.8 and 6). Live data ties the story to the real Voyager 1 tonight, and a radio search is something a kid can feel without numbers.

**Alternatives considered:** Showing Voyager 1's dot from the start (no search), a 3D sky dome in the game world (camera fights the tiny planet), free-text adventure names (privacy), a scripted cutscene with the friends walking (far more animation work for the same moment; an illustration reads as an illustration).

## 60. Chapter 2: Hadley-Apennine and the rideable Moon buggy

**Date:** 2026-11-12

**Decision:** Chapter 2 is built (`src/game/worlds/hadley/`, `src/content/chapters/hadley.ts`, `src/game/puzzles/steer-from-the-back.ts`). The little world has the lander Falcon, a flag, the science station with boot prints, Mount Hadley and Hadley Delta, and Hadley Rille as a real valley cut into the terrain (a new `channels` feature in `Terrain`, kept shallower than the horizon-culling margin). Letters go to the woven wheels, the two seats and the tracks. The activity has three steps: Dad's wheel test (a small game: smooth, plain mesh and chevron mesh wheels pushed across a dust tray; it makes no claim about rubber tires), the drive, and parking. The buggy is the first machine you ride: a world `ride` hook moves the seated kid, the front axle rolls straight and only the back wheels steer (fact `lrv-rear-steer`), so the back swings out on turns. The rille's rim, steep slopes and props stop it gently. Dad's taped LROC photo of the real tracks (PIA13058, NASA/GSFC/Arizona State University) is the map, with his pencil route and a dot for how far along the buggy is. Parking either way round inside the chalk marks counts. A new fact `a15-rille-edge` comes from the same photo's caption. Chapters can now be played in any order: Milo's parts are tracked per chapter (`chapter-N:fitted`) instead of by one stage number, and a reload part way through a chapter picks up the arrival, the activity start, or the memory and stamp.

**Why:** P1 in the Game Bible, and the most physical idea in the game. Steering from the back is something a kid feels in the first two seconds.

**Alternatives considered:** A scripted drive on rails (no feel of the rear steering), real car physics (overkill, and easy to tip on a tiny planet), the photo as a full-screen map (hides the world while driving).

## 61. Opening scene, no black flicker, freer camera, bigger map, richer true stories, space suits

**Date:** 2026-11-12

**Decision:** (1) The page opens on a CSS-only night scene (stars come out, the workshop window lights up on the little home world, the title writes in) that glides through the lit window to Dad's bench, where the notebook finishes loading. (2) The black flicker came from resizing the canvas after a frame was drawn whenever the resolution governor changed its scale: changes now wait for the start of the next drawn frame, and the governor needs two slow seconds to step down and waits a few seconds between changes. (3) The camera tilts from nearly level to nearly straight down, zooms much further both ways (mouse wheel, + and -, pinch, LB and LT, eased), turns with < and >, no longer swings back behind the player after a short pause, and a place's preferred view waits while the player has just chosen their own. (4) Dad's map panel is now up to 1280 px wide with a globe up to 720 px, bigger pins and labels, and a bigger corner map. (5) True-story cards are big taped index cards with a real picture of the machine and its credit, the place, the story in large type, a "More about it" list of the sourced details and the source. (6) Kids wear space suits on the Moon and Mars: white shells, moon boots, gloves, a life-support pack, a stripe in each kid's own colour and a clear bubble helmet so faces stay readable. (7) Lamp posts are pushed clear of every path (one stood in the middle of the north road). (8) A prompt prefers what the player faces, so neighbouring domes on the workbench no longer steal each other's prompt.

**Why:** Team feedback after playing: the book appeared instantly, black flashes, camera limits, small map and cards, a lamp post in the road, and kids in street clothes on the Moon.

**Alternatives considered:** A JS-driven splash (would wait for code to load), switching off the resolution governor (loses smoothness on slow devices), an opaque visor (hides faces), a separate facts screen (breaks the flow of play).

## 62. A 3D trip between worlds, a 3D closing shot, and roomier Moon and Mars

**Date:** 2026-11-12

**Decision:** (1) The trip through the Looking Lamp is drawn in 3D (`src/game/render/trip.ts`): the world left behind and the world ahead float in a starry night as small toon planets, each wearing a tiny model of its machine (the house, the lander, the buggy, the rover, the helicopter), and the lamp's light arcs between them with one of Dad's envelopes tumbling behind it. The camera holds a wide view of both worlds, then leans in as the light dives. The next world loads and compiles behind the closed light first, so the flight never stutters; the light then opens on the trip, closes on the world ahead as the light reaches it, and opens on the world itself. The trip has its own colour grade, so nothing shifts mid-flight. The trip runs on the real clock (a slow device shows fewer frames, not a longer trip). Reduced motion skips the flight. The 2D travel screen became a caption: where Remi is going, dark on the lamp light and pale on the night. (2) The ending picture is the real home world: the camera lifts away from Remi through the open workshop until the whole little world shows against the stars, then turns slowly while the credits roll over a dimmed view. (3) The HUD, corner map and tips step aside during trips and full-screen story screens. (4) Meridiani's breeze flags moved a good few steps from the rover. Both the Moon and Mars gained low swells far from the machines and families of boulders with room to walk round; Meridiani gained striped rock ledges on its little crater's inner wall and out on the plain. Everything new keeps clear of machines and walked tracks.

**Why:** Team feedback asked for the trips and story moments to be 3D animations with better transitions, and for more detail on the Moon and Mars without crowding.

**Alternatives considered:** A pre-rendered video (heavy, cannot show each pair of worlds), drawing the trip over the old world (the next world could not load without a visible stall), a separate 3D ending diorama (the real world with its museum visitors is stronger and costs nothing), new real-hardware props on Mars such as the heat shield (left out until each has a sourced fact).

## 63. Chapter 4: Valinor Hills and Thin Air

**Date:** 2026-11-13

**Decision:** Chapter 4 is built as Dad's model of Ingenuity's corner of Jezero Crater (`src/game/worlds/valinor/`, `src/content/chapters/valinor.ts`). Ingenuity stands on a low rise among long sand waves with one blade broken short (fact ing-final) and a tiny tan patch under its solar panel (the Wright Flyer cloth, fact ing-wright). Wright Brothers Field is Dad's square of pale pebbles with the helicopter's shadow painted in the middle, after its first picture from the air. The rover's tracks run past and away over the hill, because the real rover drove on. Letters go to the field, the tracks (with the recording of Ingenuity's hum heard by the rover) and Ingenuity. The main activity, Thin Air, has three parts: (1) Dad's rotor bench, a small game where lift is the air times the blade length squared times the spin speed squared; Mars air is exactly one hundredth of Earth air in the model (fact mars-thin-air), so the same rotor that hops on Earth needs long blades spinning very fast on Mars; the panel is labelled "Model". (2) The scout flight: Dad's toy helicopter really lifts off its pad and hovers in 3D, and its camera view opens as a small top-down game where Remi draws a safe way for a toy rover round rocks and soft sand (the solo version the Game Bible allows for P1). (3) Leave a note for later: three rows of preset word chips (never free text), kept on the device, shown again at the end. Milo gets his rotor, and Remi finds the scrap of their first drawing inside him. Two new checked facts: ing-relay (the rover's base station passed Ingenuity's messages, JPL PIA23968) and ing-scout (its later job as an aerial scout, JPL Jan. 25, 2024).

**Why:** Game Bible section 6, Chapter 4 (P1), and the team's ask for 3D story moments.

**Alternatives considered:** A co-op scout flight with one player above and others driving (comes with Phase 06 co-op), a slider-only rotor test without the Earth to Mars comparison (loses the idea), a typed note (not allowed: no free text for kids).

## 64. The trip is a rocket ride

**Date:** 2026-11-13

**Decision:** The 3D trip between worlds (decision 62) now tells a little story instead of showing a beam of light. Remi, in the space suit, walks up to Dad's toy rocket on its launch pad on the world being left, the hatch swings shut behind them, the engine lights with smoke and a short shake, and the rocket climbs away. It cruises along a curved path across the stars with a chase camera and a sparkly trail, flips over, and settles on its fins on the next world in a ring of that world's own dust (cream at home, grey on the Moon, butterscotch on Mars), with the lit hatch turned toward the camera. Each world's dress is rotated so the pad and the landing spot are clear ground. The rocket is a toy (cream body, red nose and fins, brass trim) so it reads as Dad's model, not real hardware. The ride takes about seven seconds; E, Enter, Space, a click or the gamepad's A skips to the landing. New lift-off and landing sounds play on the rocket's beats. The caption sits top left, out of the way.

**Why:** The team asked for an animation where the character climbs into a rocket in the game's own 3D style and flies to the Moon or Mars, and asked for the most impressive version.

**Alternatives considered:** A first-person cockpit view (hides Remi and needs a whole new interior model), a pre-rendered video (heavy, one fixed pair of worlds), keeping the light beam (the team found it too abstract).

## 65. One illustrated set of pop-up game cards

**Date:** 2026-11-13

**Decision:** Every small game that opens on screen (the rotor bench, the scout camera, Ingenuity's log, the wheel test, the star map, the rock grinder, the rover's last report and the calls) shares one card shell (`src/ui/game-card.css`, `src/ui/story/card/`): a coloured band for its place (green home, slate Moon, rust Mars, navy night sky) with a round drawn badge, a small label and a big handwritten title, a "Model" stamp where it is Dad's model; Remi's line in a speech box with a tiny drawn face that turns green when something works; a framed picture to play in; numbered steps that light up and tick off; one big button; and a "True story" strip once it is won, with text taken only from facts.json. The pictures got richer: the rotor bench is a workshop scene with a glass jar of air (moving dots, many for Earth air, a few for Mars air), Dad's ruler and chalk "hop!" line, a blueprint and pegboard on the wall, a lift gauge and toy dials; the scout camera has sand ripples, shaded rocks, rippled soft sand, a camera frame with a blinking dot and the helicopter's own shadow; the log is a lined page with a doodle of Ingenuity; the wheel test sits in a cool Moon-blue workshop; the calls cross a rolling dust storm to a sleeping rover. A soft vignette sits behind each card.

**Why:** The team pointed at the rotor bench card and asked for better pop-up card designs.

**Alternatives considered:** Restyling each card on its own (they would drift apart again), a dark full-screen overlay (hides the world the game belongs to), 3D cards in the scene (hard to read and to use with a keyboard).

## 66. Mars gets its landscape

**Date:** 2026-11-13

**Decision:** A shared Mars kit (`src/game/worlds/kit/mars.ts`) dresses both Mars worlds, always with room round the machines and off the paths between them: crescent dunes with a hollow lee side, in dark sand like real Martian dunes; families of faceted dark boulders with sand banked behind the biggest and pebbles round them; broken slabs of pale layered rock; and the ground gained patches of darker sand. Valinor Hills (Jezero) also gets layered buttes and a couple of balanced rocks on the skyline, and a couple of small dust devils that wander across now and then. Meridiani gets no tall buttes, because the real plain is very flat. Scattered rocks use the new faceted shapes instead of the grey Moon rocks. The space suit gained two air tanks and three status lights on the pack, a short antenna with a glowing tip, a thin collar ring and toe caps in each kid's own colour, and a chest patch, because the camera mostly sees kids from behind.

**Why:** The team said Mars looked too plain.

**Alternatives considered:** Real rover hardware as props (left out until each has a sourced fact), a denser random scatter (crowds paths, breaks the roomy-layout rule), loading external rock models (heavier and off-style).

## 67. The prologue's missing beats, and the gamepad shoulders

**Date:** 2026-11-13

**Decision:** The prologue now has every beat the Game Bible lists. At the start of a new story Mom hands Remi the key to Dad's workshop ("Here's the key to Dad's workshop.", a toast and a little jingle). Dad's lamp waits dark until Remi first steps into the workshop, then clicks on by itself; Remi says "It turned on by itself!" and Dad's note appears at the lamp: "I made it turn on by itself. So you never come home to a dark workshop." (Game Bible 5.7). Older saves and the title see the lamp lit as before. The pins on Dad's globes stay a dull pencil grey until the prologue's stamp, then light up one by one with a soft breathing glow; the Moon globe gains the Apollo 15 pin and the Mars globe the Ingenuity pin (facts a15-site and ing-site). Two new one-time tips after the stamp teach the photo button and the emote wheel, as the prologue's "Teaches" list asks. On a gamepad, LB took a photo and also zoomed out, and LT opened the map and also zoomed in; now RB pulls the camera back and RT brings it in, and running is the stick pushed all the way or a click of the left stick.

**Why:** Phase 05 checklist (Prologue, P0) and a button clash found while adding the photo tip.

**Alternatives considered:** A locked workshop door until the key is taken (adds a blocking step to the very first minute), moving the photo to another button (the HUD glyphs and the notebook already teach LB).

## 68. Dad's archive cards

**Date:** 2026-11-13

**Decision:** Six archive cards (Game Bible 6, P2) live on a corkboard on the workshop's right wall, open after the prologue: Surveyor 3 and the Apollo 12 visit, Sojourner, Viking 1, Spirit, InSight, and the Apollo 14 and 15 mirrors. "Read Dad's archive cards" opens a panel with the six cards down the side (arrow keys, the D-pad or a click flip between them). Each card shows a real NASA photo with its credit, a little globe with the landing pin and its coordinates, three checked facts, a line from Dad that makes no claim, and links to every source. The same cards, with a few more checked facts each, form a new "Dad's archive" section in the Field Guide. Dad's desk globes gained blue pins for the six archive machines next to the amber pins of his worlds. A fact-checking subagent confirmed 44 new facts on primary NASA, JPL and NSSDCA pages (all in facts.json and the Fact Sheet with quotes); where two NASA pages disagree (Viking 1's last day, the distance from Apollo 12 to Surveyor 3) the kid text says only what both agree on. The microbe story about Surveyor 3's camera stays unverified: NASA sources still disagree, so it is not used.

**Why:** Phase 05, P2 item, and Game Bible section 6 ("Add a card only when every fact on it is verified").

**Alternatives considered:** Six separate 3D props each with its own prompt (cramped, against the roomy-layout rule), cards in the notebook (the notebook is Dad's letters; the archive is his reference shelf), artist illustrations instead of photos (real photos with credits are the stronger, truer choice).

## 69. The Surveyor 3 bonus chapter: Ocean of Storms

**Date:** 2026-11-13

**Decision:** The P2 bonus chapter is a fifth little world, `storms`, Dad's model of the Apollo 12 site. Surveyor 3 (a tan tripod: frame, footpads, mast with antenna and solar panel, TV camera with its mirror hood, the folding scoop arm) stands on the inner slope of Surveyor crater with its four trenches and two sets of bounce dents up the slope; Intrepid's bottom half sits on the rim with the flag; a smaller crater makes the Snowman's head; Earth hangs low over the crater. Three letters (the trenches, Intrepid, Surveyor 3) and an activity, Pinpoint, in three steps: Dad's landing table (a top-down card game: steer the toy lander's shadow, find the Snowman, land in its tummy), Dad's cutters (a blueprint card: snip the camera, the scoop and a piece of tube into the bag), then carry the parts bag up to the sample box by Intrepid's ladder, whose lid closes. Milo gets a jointed scoop arm that digs now and then; it does not change his stage number (Game Bible 5.6 puts it between stages 3 and 4), so `ChapterDef.bonus` keeps the chapter out of the Finale gate and the next-dome goal, and `milo:stage` now names the chapter it came from. The dome sits apart on a round plant stand under the archive board, covered by a dust cloth until Chapter 3 is stamped; the first time Remi walks in after that, the cloth is whisked away. The notebook gains a "robot that waited" spread (two spreads, never scrolling) with an orbiter photo of the Apollo 12 site (LROC), and a mission patch. Stamp: "Left behind. Still teaching us how things age." (prompt 05). Every fact shown is checked; the *Science checks itself* microbe note is left out because `sur3-microbe` is still unverified (NASA sources disagree).

**Why:** Phase 05, P2 item; Game Bible section 6 and 5.6.

**Alternatives considered:** A sixth dome on the crowded workbench (against the roomy-layout rule), letting the bonus raise Milo's stage (would shift the Finale's record stage), a 3D descent flight for the landing (the card keeps it readable and testable; the camera then sweeps over the real crater instead), showing the microbe story with a "maybe" (we only show checked facts).

## 70. English only: the Filipino text is removed

**Date:** 2026-11-13

**Decision:** At the team's request, the game ships in English only. The language setting, the Filipino string table and every translation file are gone, and the Game Bible no longer lists Filipino UI (P1) or Filipino story text (P2). Read-aloud uses an English voice. A translation pass that had started in this session was thrown away before it was committed.

**Why:** Direct instruction from the team ("don't add a Tagalog version, remove it entirely").

**Alternatives considered:** Keeping the translation hooks with no translations (dead code and a setting that does nothing), hiding the setting but keeping the files (still ships text nobody reviewed).

## 71. Chapter select lists every world

**Date:** 2026-11-13

**Decision:** The Chapters panel now shows the Prologue, all four chapters, the bonus chapter and the Finale. Each row says Moon, Mars, Bonus or Home, shows a small "Stamped" mark once done, and has a Go button once that world is open (after the prologue, or with Explore freely; the bonus after Chapter 3; the Finale after every main chapter). Go starts play and travels through the Looking Lamp. Before, every built world still said "Coming soon".

**Why:** Phase 05, section 6 ("Chapter select and Explore freely").

**Alternatives considered:** Leaving chapter travel to the domes only (slower for anyone who wants to go back to a world from the menu).

## 72. The workshop changes with every stamp, and friends give hints

**Date:** 2026-11-13

**Decision:** Remi's museum shelf hangs on the workshop's left wall. Each stamp adds a keepsake and an instant photo of that world above it: a corner of mirrors (Chapter 1), a mesh wheel (2), a jar of blueberry stones (3), a rotor blade (4), a little scoop (bonus) and the golden record (Finale). Empty spots keep a blank paper label. Together with Milo's parts and the glowing domes, the room now shows how far the story has come. Playing alone, Nori, Lumi and Theo in the workshop each offer "Ask for a hint": they say the current goal's hint out loud, one tier further each time, the same tiers as the Hint button.

**Why:** Phase 05, section 6 ("The workshop changes after each chapter", "Hint system... friends in the workshop for solo").

**Alternatives considered:** Photos taped over Dad's pegboard (crowded, and covers his tools), hints only from the button (the friends would stand there with nothing to do).

## 73. Writing pass

**Date:** 2026-11-13

**Decision:** A cold copy review by a subagent found 42 issues; 39 are fixed. Highlights: no line suggests Dad is still writing; Dad's notes speak as Dad ("I made the helicopter big"); Ingenuity's ending matches its fact ("damaged its rotor blades", not "one blade"); plain-text numbers with no fact behind them are gone ("three legs", "four ditches"); hints say exactly where and what to press; "round" became "around"; quoted speech uses quote marks; Voyager's light-day line is split into short sentences; the Chapter 4 note now uses the Game Bible's own line ("I tucked a little piece of you in here"). Kept on purpose: "Thanks for waiting up" (the Bible's own prologue joke), the bonus stamp "Still teaching us how things age" (prompt 05 names it), and "chevrons" (the fact and the wheel test use the word).

**Why:** Phase 05, section 5 (writing).

**Alternatives considered:** Rewriting every chapter script from scratch (the review found the copy mostly sound).

## 74. One test from the title to the credits

**Date:** 2026-11-13

**Decision:** `tests/e2e/chapters.spec.ts` gains "From the title to the credits": the loader, the light, the title flight, the chain, New story, Skip story, the prologue's letter and stamp, the four chapters stamped through the debug hook (each has its own full playthrough), a reload, then the whole Finale through the ending and the credits roll. The Finale steps are shared with the Finale test.

**Why:** Phase 05, section 7.

**Alternatives considered:** Playing every chapter again inside this test (over twenty minutes on a software renderer, and it would repeat the chapter tests).


## 75. A no-hooks pass of Chapter 1, and what it changed

**Date:** 2026-11-13

**Decision:** A fresh subagent, told to play as an eight to ten year old and forbidden to read the code, played Chapter 1 from the workshop with only keys and mouse on a frozen build (about 78 moves). It understood the letters, the moonquake jump game and the mirror corner from the screen alone, and got stuck only on the way home. Fixes from its report:
- The way home: Dad's tag stood at the edge of the lamp's ring and its prompt took the E. The tag now steps back while you carry Milo's part, the lamp's ring wins ties (a new `weight` on interactions), and the beam is bright enough to read as light against a dark sky.
- Prompts for finished steps go away ("Turn the frame" only after the corner is built and until it is turned; "Send a light from Earth" until the round trip is timed).
- Space no longer closes story cards. It is the jump key, and a card that opened during the jump game ate the first jump. E, Enter, a click or the gamepad's A still close them.
- One fact card per beat at the little mirrors. The corner-cube card comes after the player has built a corner, after a line from Remi that ties the two together, and it shows the panel's photo, not the view from orbit.
- Plainer words: "Bring two more mirrors", "Dad's little desk with a telescope plays Earth", "watch it come back" (there was nothing to count), "Near the lander", and the notebook's pencil note says the page fills in "when the chapter is done".
- Spoken captions sit above the tip card instead of over it, and the envelope's paper clip moved off "By lamplight".
- Theo and Lumi moved off the workbench approach: Theo's hint prompt was taking the Hadley dome's E.

**Why:** Phase 05, section 7 ("a human-style pass with no hooks for Chapter 1").

**Alternatives considered:** Driving the pass from a script (it would only follow the path we already know works).

## 76. Co-op architecture

**Date:** 2026-11-13

**Decision:** One `Room` Durable Object per room code (PartyServer, SQLite, hibernation). It stores the shared story (letters, stamps, flags, Milo as one record), the room's world, and four seats (a random session id made on the device, the kid, last seen). It relays movement, emotes, phrases and four story events (`letter:delivered`, `activity:beat`, `activity:done`, `milo:stage`) by id; each client plays the words from its own copy of the story, so no text ever crosses the wire. Shared progress only grows (lists join, Milo takes the higher stage). The client bridge (`src/net/coop.ts`) merges the room's story into the local save, drops a carried letter a friend already delivered, follows the room through the Looking Lamp, and brings a late joiner in next to a friend with a puff of light. Movement goes out only while moving, at most 8 times a second, as an eight-number array; friends are drawn 160 ms in the past and slide between samples. Room codes must be three different words from the curated list and a number from 1 to 99; the Worker refuses any other `/parties/` path before it reaches a Durable Object. A dropped seat keeps its kid for five minutes, so a reconnect or a reload comes back as the same kid. The first player gets Remi; a newcomer gets the kid they last played if free, else Remi, else the next free kid.

**Why:** Phase 06, sections 1 to 5; Game Bible 8.

**Alternatives considered:** The room running each puzzle's rules (every puzzle would need a second copy on the server; the clients already agree through shared flags and ids); free-form room names (could carry a name or a message).

## 77. Co-op safety

**Date:** 2026-11-13

**Decision:** Nothing typed, ever. Codes are picked from word lists; emotes and phrases are ids from fixed lists; story ids must match a strict id pattern, so a sentence cannot pass as an id; the room drops any message off the protocol and never forwards unknown fields. Seats hold a random id, a kid and a time, nothing else, and photos never leave the device. Rooms are never listed, and an alarm clears a room's storage a day after the last play. Each socket has a message bucket (40, refilling 20 a second); a flood is dropped and a socket that keeps flooding is closed. At most four players. The only server log is a room error line with no player data.

**Why:** Phase 06, section 6; CLAUDE.md kid safety.

**Alternatives considered:** Letting players name their room (free text).

## 78. Co-op on the free tier

**Date:** 2026-11-13

**Decision:** Budget, from Cloudflare's Durable Objects pricing page (Workers Free: 100,000 requests a day, 13,000 GB-s of duration a day, 100,000 SQLite rows written a day; incoming WebSocket messages count 20 to 1; outgoing messages are free):
- Messages: a walking player sends at most 8 a second and an idle player sends none (the e2e test measures both). A player who walks about half the time sends about 14,400 an hour, which is about 720 requests. Two players: about 1,440 requests per room-hour; four: about 2,900. The request limit stretches to about 69 two-player room-hours a day.
- Duration is the tighter limit: a room that hears a message every few seconds stays awake, at 128 MB that is 0.125 GB x 3,600 s = 450 GB-s per busy room-hour, so about 29 busy room-hours a day. Idle rooms hibernate and cost nothing.
- Writes: a hello writes a few rows, a story beat one, "last active" at most every ten minutes; well under the 100,000 a day.
When any limit is hit the socket fails, the client stops after three tries and says "Co-op is resting right now. You can keep playing solo."

**Why:** Phase 06, section 7.

**Alternatives considered:** Sending movement on a fixed tick even when still (would roughly double traffic for no gain).

## 79. Co-op roles: hold it steady

**Date:** 2026-11-13

**Decision:** The seven station games (Dad's landing table and cutters, the wheel test, the rotor bench, the scout flight, Ingenuity's log, the dish) are where co-op roles live. While one player plays a station's game, a new station appears for friends nearby: "Hold it steady for Nori". A helper's name and face show above the player's game card ("Lumi is holding it steady."), and the games with a skill in them get kinder: the landing table counts the Snowman's tummy from farther out, and the dish locks on from farther away. The helper lets go when the game ends ("Nice teamwork!"), when they walk away, or with E. Solo, Dad's clamps hold everything, so every puzzle works with any number of players. Pieces and steps are shared flags, so friends can also split a puzzle's parts (two players can carry Chapter 1's two spare mirrors at once). The room only relays who plays and who holds; it stores neither.

**Why:** Phase 06, section 5 ("holders become players holding pieces steady, extra stations appear when more people are present"); Game Bible 8.

**Alternatives considered:** A separate co-op version of each puzzle (doubles every puzzle, and a solo player would miss half of it); roles assigned by the room (players should choose to help, not be told).

## 80. Prompts refresh after a press

**Date:** 2026-11-13

**Decision:** The interaction system read an item's label before running its action and then keyed the prompt on the label read after, so when a press changed the words ("Hold it steady" to "Let go", or a step's prompt to nothing new) the old words could stay on screen. It now reads the label again after a press and uses the same words for the prompt and its key. This is likely the "old prompts stay up" the Chapter 1 play-tester saw. The room also stopped sending anything to a socket that has not said hello yet (a test on the live site caught a move arriving before a welcome).

**Why:** Phase 06 tests and the no-hooks pass (#75).

**Alternatives considered:** None; both were bugs.

## 81. Feedback pass 3, part 1

**Date:** 2026-11-14

**Decision:** The team's "continue prompt" after the Phase 06 report came with a feedback list, so Phase 07 starts with it. First fixes:
- Trails: straight trails were sampled as one strip from end to end (`sampleTrail` took a single step when a trail had no bend), and junction patches were one fan from the middle to the rim. On a round planet those long flat triangles dip 3 to 8 cm under the ground, so the grass hid whole stretches of trail at some camera angles. Every trail is now sampled every 0.28 m and junctions are built in six rings. A debug probe (`__poh.groundProbe(ahead, side)`) lists what lies under a spot, which found it.
- No text highlight: `user-select: none` on the whole page (form fields excepted), images and SVG never drag.
- Map: the wheel and a pinch zoom smoothly between 0.55 and 4 (the old steps were 1 to 3.2), so the whole little planet can float on the page; a flick keeps the globe turning for a moment.
- Settings gain "Paper arrow" (on by default).

**Why:** Team feedback, 2026-11-14.

**Alternatives considered:** Lifting trails higher above the grass (they would float on slopes), or drawing them without a depth test (they would show through hills and props).

## 82. Into the dome, not a countdown

**Date:** 2026-11-14

**Decision:** Looking into one of Dad's domes no longer shows the 3, 2, 1 countdown. The camera swings close over the glass, pushes down into the little world, and the lamp light closes around the dome where it sits on screen; then the rocket trip plays. Each dome now holds a small planet with its machine on top: the gold lander base with its mirror panel and moonquake listener at Tranquility Base, the buggy by a winding rille at Hadley, Opportunity with blue wings by a little crater at Meridiani, and Ingenuity with crossed blades and rover tracks at Valinor Hills. The HUD steps aside during the dive and any trip. Reduced motion skips the dive and goes straight to the trip.

**Why:** Team feedback, 2026-11-14: "when using tranquility base do something else instead of a countdown do animations too". A dive into the diorama ties the bench to the world you arrive in.

**Alternatives considered:** A 2D zoom on a flat picture of the dome (breaks the 3D look); keeping the countdown over the dive (two transitions back to back felt slow).

## 83. A longer, livelier rocket trip

**Date:** 2026-11-14

**Decision:** The trip between worlds grows from 6.7 to 8.85 seconds, and the extra time goes to the flight. Thin streaks of light line the path so the speed reads, little rocks tumble past, and a comet drifts far off. Halfway, the camera cuts to ride alongside, a little slower than the rocket, so Dad's rocket comes up from behind, does one happy roll as it passes, and pulls away; then the camera drops in behind it with the next world growing ahead. A new "whoosh" sound plays as it passes. The trip now calls its own sounds (lift-off, whoosh, landing) on its beats, so they stay in step when a player skips ahead; the old fixed timers in the travel screen are gone. Skip still jumps to the landing.

**Why:** Team feedback, 2026-11-14: "Further improve the 3d animation too of traveling to other planets". The old cruise lasted under two seconds of one chase angle.

**Alternatives considered:** A porthole view from inside the rocket (a new interior model for one shot), a warp-tunnel effect (reads as science fiction, not Dad's toy), passing a ringed planet (would suggest a real planet sits between the Earth and Mars).

## 84. Fly Dad's rocket anywhere

**Date:** 2026-11-14

**Decision:** Dad's model rocket in the yard is now a way to travel: "Fly Dad's rocket" opens a "Where to?" card with three little planets (home, the Moon, Mars) and each place as a ticket under its planet. The map has the same button ("Fly to the Moon or Mars"), so it works from any world. A place is open on the same rule as the chapter list (after the prologue, or with Explore freely; the bonus after Chapter 3). Flying home lands you in front of the toy rocket. The 3, 2, 1 countdown is gone everywhere: a dome trip starts with the dive, every other trip goes straight to the rocket ride.

**Why:** Team feedback, 2026-11-14: "Game should also have a way to go freely to mars and moon." The chapter list in the menu already allowed it, but nobody found it; a rocket in the yard and a button on the map are where a player looks.

**Alternatives considered:** A parked rocket in every little world (each world would need room for it off the paths), a travel row on the HUD (more buttons on screen during play).

## 85. A loading page in the game's own look

**Date:** 2026-11-14

**Decision:** The two loading pictures (a flat night hill with the house, then Dad's notebook on the bench) are replaced by one scene in the game's look, in 2.5D. The little home planet turns slowly under the night sky with Dad's workshop, the house, the windpump, the toy rocket and the balloon going round on it; Remi walks on top with a letter; the Moon (with a gold lander) and Mars (with a blue-winged rover) hang in the sky, and Dad's letters fly the dotted routes out to them. The title is the same chunky block letters as the 3D title (cream faces on wooden sides, OF in amber, the O of HOME a bulb), dropping in letter by letter. Layers lean with the pointer, near ones more than far ones. A pinned paper card ticks through "Things that kept working" (each line still a checked fact) with a progress bar, then becomes a "Turn on the light" button; the bulb in the title lights and its light fills the screen and becomes Dad's lamp in the 3D workshop, as before.

Loops move in steps, about a dozen frames a second, like paper stop motion. The planet is one image, drawn once, so turning it never redraws its paths. When the browser draws WebGL in software (no graphics chip), the loops hold still: under two parallel test browsers the moving planet made booting take about 90 seconds instead of 6.

**Why:** Team feedback, 2026-11-14: the landing page "does not match the game style", make it animated "like in the menu", 2.5D or 3D.

**Alternatives considered:** A real Three.js scene for the loader (needs the engine's code before anything shows, which is the wait the loader covers), a looping video (big download, blurry text), keeping the notebook but restyling it (still not the game's look).

## 86. The story before a new game plays in the world

**Date:** 2026-11-14

**Decision:** The six pages of the short story are now shots of the home planet itself, not flat drawings: the planet at dusk from orbit, Dad's bench with the lamp and the domes, Remi at the workshop door, the little worlds under glass, Milo in pieces, and Remi on the path facing the mailbox. Between pages the lamp light closes and opens (the game's own way of changing place), and the camera drifts slowly in while a page is read. The words sit on a pinned paper card between letterbox bars. The last shot is where the game starts, so "Let's go" flies the camera straight down behind Remi. A new story loads the fresh save before the first page, so the shots show the world as it begins, and the friends who wait in the workshop stay out of the story (Remi opens it alone). Reduced motion cuts between shots with no drift.

**Why:** Team feedback, 2026-11-14: "further improve the story animation u can make image 1 and 2 2.5d/3d animated and it should match the game's style".

**Alternatives considered:** Animated 2D drawings (still not the game's look), a pre-rendered video (big, and it would not match the player's own world and settings).

## 87. One full spread per machine, and Dad's letters opened

**Date:** 2026-11-14

**Decision:** Dad's notebook now has one spread per machine instead of two (9 spreads in all, was 16). The second spreads were mostly empty: the lamp's right page was blank, and "Deeper notes" often held one line. Now the left page has the drawing, what it was for, Dad's note and Then and Now; the right page has the photos, what we learned, the deeper notes and "Letters delivered here", with the chapter's stamp pressed into the corner like a postmark. The lamp's spread holds the grid of letters still in the notebook. Pages still in pencil are full too: a ghost "Then and now" box and the chapter's letters still sealed, so a player can see who the letters are for before going.

Dad's letters are now read. Each letter had words written for it that never reached the screen. When Remi delivers one, the envelope drops in, its flap opens, the letter slides out in Dad's hand, and a red "Delivered. By Remi." stamp lands on its corner; the moment after it waits until the player folds it up (E, Enter, click, tap or A). Any delivered letter can be read again from its notebook page.

**Why:** Team feedback, 2026-11-14: the notebook "has too much spacing and some pages has nothing placed in it", and "improve mail UI too". Reading the letters is also the heart of the story: they are what the game is about.

**Alternatives considered:** Keeping two spreads and adding pictures to fill them (no more sourced pictures to add), showing the letter text as a note card (loses the feeling of opening mail).

## 88. The title flight keeps the lamp lit and the room clear

**Date:** 2026-11-14

**Decision:** During the title and the short story, Dad's lamp is always lit, even at night or before the player has pulled its chain in the workshop. The flight from the lamp no longer passes through anyone: Remi is hidden until the camera flies down to him, and the friends who wait in the workshop stay out of the room until the title is over.

**Why:** Team feedback, 2026-11-14: "after turning on the light switch when it is night the lamp is dark and also when zooming out animation my character clips out in the animation like i can see my character pass through". The night save turns the lamp off until it is clicked, and the friend at the desk sat right on the camera's path.

**Alternatives considered:** Bending the camera path around the desk (the path is tuned to frame the lamp and window), fading the characters (still a ghost passing by the lens).

## 89. The Field Guide and About open inside the game

**Date:** 2026-11-14

**Decision:** The menu's Field Guide now opens a panel in the game instead of leaving for another page. It is a drawer of paper tabs (the story, one tab per machine with Dad's sketch, Dad's archive, using it in class, sources) beside one ruled index card. Each machine card has Dad's sketch, his note, where it is, what it was for, what we learned, Then and Now, deeper notes and the photos with their credits, every fact with its source link. "Print this guide" lays every page out one after another for paper (19 A4 pages) and prints only that. The About page is now a tab inside Credits: how to play, safe to play together, For grown-ups, facts and honesty, who made it. The NASA line stays in Credits.

The plain HTML Field Guide still exists, but only as the fallback for computers without WebGL (the loader's kind paper note links to it), as the Game Bible asks.

**Why:** Team feedback, 2026-11-14: "fix field credits it should be adapted ingame not a different page". Leaving the game for a website page broke the feeling of the game and its style.

**Alternatives considered:** Restyling the web page to look like the game (still a different page, and the 3D world is lost behind it), dropping the plain page (no path left for computers without 3D).

## 90. Play together: paper tiles instead of browser dropdowns

**Date:** 2026-11-14

**Decision:** Joining a room no longer uses the browser's own dropdown lists. The code shows as four paper tiles, the same tiles a friend sees on their room code. Each tile has little arrows above and below to spin it, the arrow keys spin a focused tile, and a letter key jumps to the first word with that letter. Tapping a tile lays a board of every word (or every number) over the Make card, with a paper arrow pointing at the tile it sets; the words the other tiles use are greyed out, and spinning skips them, so a code can never repeat a word. The Make card shows the four kids, so the "up to four" is easy to see. Still no typing anywhere.

**Why:** Team feedback, 2026-11-14 ("fix play together UI", with a picture of the native dropdown): the dropdown looked like a web form, not the game.

**Alternatives considered:** A styled custom dropdown (still a list to scroll through), a single scroll wheel per word (hard with a mouse, slow with 40 words).

## 91. Cuter voices, music and sounds

**Date:** 2026-11-14

**Decision:** The murmur voices are small and bubbly now. The kids talk higher (about 295 to 420 Hz) and quicker through a smaller mouth, every syllable lands on a note of the game's pentatonic scale so the babble sounds sung, each syllable pops up into its note with a little "bwip", the mouth bounces between syllables instead of droning, consonants are soft taps instead of hisses, the vibrato is a touch quicker, and a soft sine an octave up adds sparkle. Dad's hum and Milo's bleeps are unchanged.

The music is brighter and lighter: a little faster on every world (home 80 bpm, Mars 74, Moon 58), the pads open up, the record crackle is quieter, and a new kalimba layer bounces a five-note figure on chord tones (resting every fourth bar, sparse on the Moon, fewer notes on low-power devices, softer in focus, gone in the Long Storm). The UI and pickup sounds are rounder: menu ticks are a tiny wooden "tok" with a soft bell, pops are bubbles, a picked-up letter skips up three music-box notes, emotes pop like soap bubbles, toasts go "ding-ding", the stamp ends on a happy ding, and a jump has a soft springy boing.

**Why:** Team feedback, 2026-11-14: "improve murmur voice sound and also background music and sfxs make it cuter".

**Alternatives considered:** Recorded "animalese" letter samples (would need recording or sourcing per-letter clips under our license rules, and a big download), only raising pitch (sounded like sped-up tape, not cute).

## 92. More to see round the Moon and Mars worlds

**Date:** 2026-11-14

**Decision:** Every Moon and Mars world now has company in its sky and more texture on its ground, added by one shared helper (`src/game/worlds/kit/surroundings.ts`) after each world is built:

- Things in orbit (`kit/orbiters.ts`): two little model probes (gold or silver foil, blue solar wings, a white dish looking down) round each Moon world, and round each Mars world its two small lumpy moons plus a probe. The first one always starts low in the sky ahead of the arrival spot, on the side away from the Sun, so the first look round shows it; then it drifts across. They ignore the world's haze so Mars's dusty sky never hides them, and they slow down with reduced motion.
- Low rounded hills on the skyline of Tranquility Base and the Ocean of Storms (Hadley already has its mountains; Meridiani stays flat like the real plain).
- A scatter of a few hundred small stones (fewer on slow devices), kept off the paths, the marked places and the craters.

Everything keeps well clear of the machines and the walked paths. Nothing is labelled, so no new facts are claimed; the worlds stay "Model, not to scale".

**Why:** Team feedback, 2026-11-14: "for both mars and moon, add more things like assets or objects around the planet so that it doesnt look boring".

**Alternatives considered:** More boulders and craters on the ground only (the worlds already had them, and the sky stayed empty), labelled real orbiters such as a Moon reconnaissance orbiter (would add claims to source and keep accurate).

## 93. "Your adventure": one card that says what to do

**Date:** 2026-11-14

**Decision:** When a new story starts, right after the camera lands behind Remi, one card explains the whole game in three steps, each with a small moving drawing: find Dad's letters (Mom has the key, the first letter is in the mailbox), step into his little worlds (look into a glass dome to go inside, give each letter to its machine), and finish Milo (every world gives a part). Under them: follow the paper arrow and the note in the corner, press H when stuck, nothing can go wrong; and the five keys that matter (WASD, E, N, M, H). E, Enter, Space, Escape, a click, a tap or gamepad A or B closes it, and then Mom hands over the key and the step-by-step tips begin as before. It shows once per new story and is skipped by Continue.

Also fixed while testing it: skipping the story in the middle of a lamp-light cut could leave the light closed, so the world looked like a flat amber screen. The newest iris animation now always wins, and ending the story stops any cut still moving.

**Why:** Team feedback, 2026-11-14: "there should be a short tutorial or an entry of whats happening and what to do or maybe an animation will do too for that". The story said what was happening; nothing yet said plainly what the player does.

**Alternatives considered:** A playable tutorial level (the prologue already teaches one control at a time; a second one would slow the start), more story pages (the story is about feelings, not keys).

## 94. The loading page is Dad's notebook again, in front of the real 3D workshop

**Date:** 2026-11-14

**Decision:** The 2.5D planet loader (#85) is replaced. The loading page is Dad's notebook once more (the idea from #34, which the team liked), now the same leather notebook as in the game, held open in his dark workshop. The workshop behind it is not a drawing: it is a picture the game renders of itself (`scripts/render-backdrop.ts`, 2592x1080 WebP, about 41 KB, plus a 142-byte blurred copy inlined for the first paint). It is the exact first frame of the title flight with Dad's lamp dark, sized the way the 3D camera sees (full height, sides cropped), so it lines up with the live view on any landscape screen.

The notebook rises and swings open. Left page: Dad's sketch of his lamp draws itself with the real loading progress (five strokes in three boiling copies), his notes appear beside each finished part, and a letter flies a dotted route home, Moon, Mars. Right page: the block-letter title from the 3D title, the red postmark, "Things that kept working" written in pencil and inked as each loading milestone lands (each line still a checked fact), a pencil that moves down the list, then Dad's dedication and a wall light switch. The book leans a little toward the pointer.

The switch is the handoff. Pressing it flips the lever, the notebook closes and drops out of frame, the room comes into focus, and the picture fades to the live world, which has been drawing the same view behind it since the press. Dad's lamp then flickers on in 3D (a quick on, off, on) and warms the room, and the camera pulls away into the title flight. Before the switch the workshop sits in cool moonlight (the fill light is dimmed while the title lamp is off), so the light coming on is a real lighting change, not a flat flash. Loader classes that clashed with the game's global CSS (`.tag`, `.switch`, `.done`, `.paper`) are prefixed `ld-`. The WebGL probe that the old loader made at startup (about 180 ms on the main thread) is gone; the game tells the page when it is drawing in software and the page holds its loops still.

**Why:** Team feedback, 2026-11-14 (with a picture of the planet loader): it "does not match the game style design and 3d"; "why did u remove the book landing page i just needed the idea to be further improved". A real render of the game is the game's style by definition, and a notebook in front of it keeps the book idea and the in-game notebook's look.

**Alternatives considered:** A live Three.js scene on the loader (needs the engine before anything shows, which is the wait the loader covers), the previous top-down notebook on a flat desk (did not look like the game), a looping video (large, and would not hand off to the live view).

## 95. The story before a new game is a storybook with page turns and camera moves

**Date:** 2026-11-14

**Decision:** The short story (#86) keeps its six shots of the live world, with three changes. Each shot now has its own camera glide over the reading time (a drift round the planet, a slide along the bench, a push in over Remi's shoulder, down toward the domes, an arc round Milo, a crane down behind Remi), eased like a film camera. The words sit on a torn page of Dad's grid notebook taped over the bottom of the picture, beside one of Dad's ink doodles that draws itself (planet, lamp, door, letter and dome, Milo, mailbox), and they ink in word by word; a pencil line under them draws across as the page's reading time runs. Between pages a sheet of grid paper sweeps across the whole screen with a slight 3D turn, carrying the next page's doodle and number, and the shot changes while the paper covers it (`engine.storyCut`), instead of the lamp-light iris. The last shot is framed wider so Remi is not a giant head. Reduced motion cuts between pages with no glide and no sweep.

**Why:** Team feedback, 2026-11-14: the story and opening animations should "use the game style and design and animation further improve it". A turning page is what a storybook does, and Dad's notebook paper is the game's own 2D language.

**Alternatives considered:** Keeping the lamp-light iris between pages (the game's travel transition; reads as changing worlds, not turning pages), a book spread with the 3D shot as a photo inside it (the shot would be half the screen).

## 96. Smoother opening: shaders, lights and world building

**Date:** 2026-11-14

**Decision:** Four fixes to the stutters players felt when the game opens, found by profiling the real intro on Chrome with a graphics chip (`scripts/perf-boot.ts`):

1. Shaders were warmed up for the screen (sRGB output), but every scene draws into the post pipeline's linear target, so the real programs compiled the first time each thing showed: 6 to 9 hitches of 90 to 220 ms during the title flight. Warm-up now compiles inside the scene target (`PostPipeline.withSceneTarget`), the screen passes are compiled too, and the trip's shaders compile before the light is switched on instead of four seconds into the flight.
2. When the title ended, its light left the scene, and a change in the number of lights recompiles every material: a stall of 0.5 to 0.95 s right as a new story or play began. The title is now hidden with its light kept at zero, and a dark stand-in light takes its place when it is disposed.
3. The model kit cloned each source shape for every piece, and a clone of a sphere or cylinder first builds a whole default one: about 600 ms of the home world's 1.25 s build. Each shape's stripped arrays are now worked out once and shared. Ground painting skips far-away spots with one dot product.
4. The home world builds in slices with a yield between them (`core/yield.ts`), so the loading page never freezes for a second.

Measured on the RTX 4050 laptop (dev build): main-thread long tasks before the light went from 2.3 s to about 1 s, the title flight has no shader stalls, and the worst stall when a new story starts went from 957 ms to 77 ms. The one long task left in the title (about 120 ms) is the sound engine starting inside the press, while the notebook animation (on the compositor) hides it.

**Why:** Team feedback, 2026-11-14: "optimize the game and make it smoother my game lags when opening the game".

**Alternatives considered:** Lowering the quality tier at start (hides the cause and looks worse), a longer loading wait to compile everything (the cause was compiling the wrong programs, not compiling too late).
