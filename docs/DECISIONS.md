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
