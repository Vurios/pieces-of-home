# Progress

There is no deadline. The full scope in the Game Bible gets built: P0, then P1, then P2. Quality is never traded for speed.

- **Live URL:** https://piecesofhome.pages.dev
- **Repo:** https://github.com/Vurios/pieces-of-home (public). No CI: the team asked for straight pushes to `main`. Run typecheck, tests and e2e locally before pushing.
- **Team rule for this run:** the agent asks the team before starting each next phase prompt.

**Now:** Phase 05 in progress. Chapters 1 (Tranquility Base) and 3 (Meridiani Planum) and the Finale (The Long Light, #59) are playable end to end, each with a full playthrough test. Chapter 3 adds Wait for the Wind (breeze flags steer dust devils over the panels), three story games, the long storm and the real Mars wind (DECISIONS #52). Dad's map is in: a corner map and a globe to spin on every world (#53). Front-end polish from team review (#54). A word-aware murmur for speech (#55), the corner map as a gliding compass and a calmer globe (#56), smoother frames from horizon culling and early shader compiles (#57), a foldable mission note and a travel screen between worlds (#58). Phase 06 waits until Phase 05 is complete. **Next up:** Chapter 2 (Hadley) and Chapter 4 (Valinor), then P2, the writing pass and the remaining checklist items, then Phase 06. Ask the team before starting Phase 07.

## State summary (2026-11-11)

Phases 01 and 02 are done, plus a world and character pass (`DECISIONS.md` #21). The live site is a walkable Home planet at dusk: the house and porch, Mom's garden, the mailbox, Dad's workshop (it opens like a dollhouse when you step in), the workbench with Milo (stage 0), Mom on the porch with her tea, the notebook, Dad's lamp, four glass domes and two NASA-map globes with sourced landing pins, a meadow, a dish and a telescope on the hill. Remi walks, runs and jumps; Nori, Lumi and Theo wait in the workshop. A placeholder letter loop (take the letter from the mailbox, give it to the lamp) proves the interaction and carry systems. The paper arrow points to the next goal. Phase 03 added the front door: a paper loader that draws Dad's lamp from real progress, "Turn on the light", a 3D title flight out of the workshop to the block-letter title with the bulb O and the BEGIN pull chain, notebook-tab menu, HUD stamps, speech bubbles and captions, the stamp moment, toasts, emotes, Dad's notebook (pencil pages ink in as chapters finish), settings, and the printable Field Guide and About pages.

Things a new session should know:

- A plain visit plays the real intro. `?test`, `?shot` and `?skip` jump straight into play; add `?intro` to run the intro in tests.
- Intro screenshots: `npx tsx scripts/screens-intro.ts phase03 [url] desktop [all|intro|notebook|guide]`. Loader timing: `npx tsx scripts/measure-loader.ts [url] [4g|3g]`.
- `npm run test` goes through `scripts/vitest.mjs` (Windows drive-letter fix, DECISIONS #27).
- `npm run dev` runs Vite with the real Workers runtime on port 5173. `npm run typecheck` regenerates Worker types first.
- Skills are git-ignored. After a fresh clone run `npx skills experimental_install` to restore them from `skills-lock.json` (`DECISIONS.md` #9).
- Co-op is solo by default. Add `?room=some-code` to open a room socket. The page mirrors state on `<html data-net data-players data-stage data-tier>` for tests.
- URL switches: `?quality=low|medium|high`, `?shot=wide|orbit-back|orbit-west|orbit-east|orbit-north|orbit-south|porch|mom|workshop|bench|character` (fixed camera bookmarks) or `?shot=play-yard|play-garden|play-shed|play-hill|play-meadow|play-treehouse|play-pond|play-camp|play-weather|play-playground|play-rocket|play-orchard|play-windpump|play-balloon` (player placed, normal camera), `?debug` (fps overlay, always on in dev), `?test` (exposes `window.__poh`).
- Home layout lives in `src/game/worlds/home/layout.ts` (sites, trails, places, terrain). Places are built in `places.ts`, paths in `paths.ts`, place names and lines in `src/content/places.ts`.
- Screenshots: `npx tsx scripts/screens.ts <folder> [shots] [url] [quality]` with the dev server running. Desktop only, 1440x900 (DECISIONS #41). Latest set is in `docs/screens/pass7/`. Character close-ups: `?shot=character|character-back|character-side|friend-nori|friend-lumi|friend-theo|mom`.
- Audio: `src/audio/` (see DECISIONS #42). Review every sound at `/audio-lab/`: buttons per cue, music and ambience switches, a live meter, "Measure every effect and voice" (offline peak, loudness and click check) and a one-minute recorder. Dad's real voice lines go in `public/audio/vo/<line>.ogg` (the first is `prologue-lamp-thanks`).
- Playwright runs with 2 workers, and walk tests use the Low tier (`DECISIONS.md` #8, #18).
- NASA models: `npx tsx scripts/assets/nasa-models.ts build` (output to `.cache/` until a phase ships one).
- Facts: 56 (54 checked). Location facts carry `lat`/`lon`. Report: `docs/research/facts-check-2026-11.md`.
- Chapters: `?world=tranquility` (with `?test`) starts in a chapter world. Hooks: `__poh.teleportTo(id)`, `__poh.world("solve"|"deliver"|"fire"|"beam")`, `__poh.patch({...})`, `__poh.travel(id, entry)`.
- Engine map: `src/game/engine.ts` (loop), `core/` (events, input, quality, state), `world/` (sphere math, terrain, colliders, controller, camera, interaction), `render/` (toon, post, grade, sky, particles, kit), `actors/` (kids, Milo, props), `worlds/home/`.

## Phase 01: Setup, skills, scaffold and first deploy

- [x] Machine checked: Node 24, npm 11, git, gh (logged in), Chrome, wrangler (logged in)
- [x] Skills installed and documented in `docs/SKILLS.md`
  - [x] design-taste-frontend (tasteskill 2.5.1)
  - [x] frontend-design
  - [x] webapp-testing
  - [x] Three.js skills (13)
  - [x] Official Cloudflare skills: durable-objects, workers-best-practices, wrangler
- [x] Hosting decision logged (`DECISIONS.md` #1)
- [x] Scaffold: Vite, TypeScript strict, Svelte 5, Three.js, Cloudflare Vite plugin
- [x] `wrangler.jsonc`: assets with single-page-app handling, Worker first only on `/parties/*` and `/api/*`, `Room` binding, SQLite migration `v1`
- [x] Worker: `GET /api/health`, `Room` (PartyServer, hibernation, player count, hello)
- [x] Static headers: hashed assets cached one year, `index.html` not cached
- [x] Scripts: dev, build, preview, typecheck, test, e2e, e2e:live, check:facts, deploy
- [x] Vitest (14 tests) and Playwright (4 tests on desktop and phone sizes)
- [x] Inline paper loader placeholder in `index.html`
- [x] `src/data/facts.json` seeded from the Fact Sheet; `npm run check:facts` runs and gates the build
- [x] README, LICENSE (MIT), CREDITS.md, `src/data/credits.json`
- [x] CI removed at the team's request (2026-11-10). Checks run locally before each push
- [x] Public GitHub repo created and pushed
- [x] Deployed to Cloudflare; live smoke test passes (page, health, room WebSocket, two players counted)
- [x] PROGRESS.md, DECISIONS.md, SKILLS.md, `docs/screens/`

## Phase 02: Tiny-planet engine and the look

- [x] Studied the reference (scene structure, depth outlines plus LUT idea). Wrote our own; nothing copied
- [x] Engine systems: sphere controller (walk, run, jump, soft landing, step-up, colliders), calm follow camera (stable horizon, lag, look-ahead, recenter only when walking away, pull-in past props, place hints such as the dollhouse view), paper objective arrow, interaction prompts (press and hold), carry, input (keyboard with remappable keys, mouse, touch stick and buttons, gamepad), world manager with lazy world chunks and the Looking Lamp iris, typed event bus, serializable state with autosave, quality tiers with a frame watchdog, dev debug overlay
- [x] Rendering: 3-band toon with paint breakup and warm rim; depth-based ink in warm grey with distance fade and boil; LUT grade per world; grain; vignette; tilt-shift on Medium and High; painted sky dome with clouds and stars; footstep puffs, lamp motes, fireflies
- [x] Home world, first pass, lamp-lit, with globes (NASA SVS Moon, USGS Mars) and fact-sourced pins
- [x] Four kids and Milo stage 0 in place; character approach logged (`DECISIONS.md` #11)
- [x] NASA hardware model pipeline (`scripts/assets/`, `DECISIONS.md` #17)
- [x] Two screenshot review passes, plus an independent subagent art review; saved in `docs/screens/phase02/`
- [x] Performance: 180 fps at High on an RTX 4050 laptop GPU; Low tier 46 calls, 111k triangles. Real mid laptop and phone still to measure in Phase 07
- [x] Tests: 32 unit, 11 Playwright (smoke, walk, letter loop on desktop and touch, every tier)
- [x] Deploy and live smoke test

Open items carried forward from the art review (to finish in Phases 03 and 05):

- [x] Wide shot: tuned for the title sequence (Phase 03)
- Remi's backpack and Theo's goggles could read even stronger; revisit with the title close-ups
- Hand-drawn labels on Dad's tags, the crates and the workshop sign (needs the type system from Phase 03)

## World and character pass (between Phases 02 and 03)

- [x] Wind sway layer, no-shadow detail layer, horizon fog, near-camera dither fade, chimney smoke
- [x] Yard and story props around the house, workshop, garden, dish and hill (`worlds/home/yard.ts`)
- [x] Trees, grass, flowers and rocks reworked; shade painted under trees
- [x] Kids: faces, hands, shoes, Remi's hair and swinging backpack, friends look at the player
- [x] Mom on the porch (sips, watches, waves)
- [x] Characters merged per joint: 118 calls on Low, 223 on High
- [x] Desktop review passes saved in `docs/screens/pass3/`
- [x] Typecheck, 32 unit tests, 12 Playwright tests pass

## Phase 03: Loading screen, title sequence and the notebook UI

- [x] Inline loader: paper, grid, coffee ring and grain; the lamp draws itself stroke by stroke from real weighted progress with a 3-frame boil; "Things that kept working" from fact `short` wording; warm bloom and "Turn on the light"; slow-load note, no-WebGL note with a Field Guide link, reduced motion, a `progress` element and live region (DECISIONS #23)
- [x] Light press unlocks audio (retries on the next gesture after a gamepad press); page curl into the title
- [x] Title in 3D: dolly back from Dad's rebuilt lamp out the workshop door, up over the planet; PIECES / OF / HOME block letters drop with a note each; bulb O warms; pull-chain BEGIN (drag, click, tap, Enter, gamepad A); windows light and music starts on the pull (DECISIONS #24)
- [x] Menu as notebook tabs: Continue, New story (with confirm), Play together, Chapters (after the prologue or with Explore freely), Field Guide, Settings, Credits
- [x] HUD: ink stamps (Notebook, Photo, Emote, Settings, Hint) with key or pad glyphs, interact prompt glyphs, speech bubbles with typed text and voice blips, captions, stamp moment, toasts, emote wheel with preset phrases, touch stick and buttons
- [x] Notebook: cover and contents, a spread per machine (pencil until done, then inked), polaroids with exact credits, Then and now, Deeper notes, the letters still to deliver, page turns by drag, keys and gamepad, read-aloud, rough.js sketches and perfect-freehand underlines
- [x] Settings: five audio buses, subtitles, bubbles, read-aloud, high contrast, text size, dyslexia-friendly font, motion, key remap, quality tier, language (Filipino stub), Explore freely
- [x] Field Guide (`/field-guide/`) and About (`/about/`) as static semantic pages from the same data, with a print sheet and numbered sources (DECISIONS #25)
- [x] Type system: Kalam, Atkinson Hyperlegible Next, Zilla Slab, OpenDyslexic, self-hosted (DECISIONS #22)
- [x] Gamepad for every 2D screen (DECISIONS #26)
- [x] Screenshots reviewed and saved in `docs/screens/phase03/` (desktop only, at the team's request)
- [x] axe-core: no serious or critical issues on the menu, settings, credits, notebook, Field Guide and About
- [x] Keyboard-only and gamepad-only Playwright passes through loader, title, menu and notebook
- [x] Timing on the live site (fresh cache): first paint 480 ms and light ready 3.7 s on 4G; first paint 870 ms and light ready 6.0 s on Fast 3G (both include the 1.2 s settle). Whole build 2.5 MB; main script 240 KB gzipped
- [x] Typecheck, svelte-check, 44 unit tests, 22 Playwright tests (local and live), check:facts pass
- [x] Committed, pushed, deployed, live smoke test passed

## Home and front-end pass (after Phase 03, at the team's request)

- [x] Notebook rebuilt as real spreads with envelopes, wax seals, polaroids, Then and now labels and a shaded page turn; menu, HUD and panels in one dusk-glass style; Field Guide and About restyled (DECISIONS #28)
- [x] Goal card, chapter card and one-at-a-time how-to tips that end when the player does the thing; Hint repeats the goal; tips can be hidden or replayed from Settings (DECISIONS #29)
- [x] Paper arrow now points at the goal, not back at the player; lamp pull chain hangs from the shade rim
- [x] Kids and Mom: knees and elbows, even-radius limbs, better walk, run, jump and landing (DECISIONS #32)
- [x] Home planet: radius 20 m, smooth round silhouette, low wide hill, more room round every building, one low porch step (DECISIONS #30)
- [x] Nine places to find all round the planet, each named on arrival with a "New place found" card; the Explore goal counts them (DECISIONS #30)
- [x] Footpaths redrawn as smooth curved ribbons with round junctions, pebbles and porch stepping stones; twelve lamp posts along the long trails (DECISIONS #31)
- [x] Slow-device fixes: frozen world redrawn rarely under overlays, menu pad polled on a timer (DECISIONS #33)
- [x] Screens in `docs/screens/pass4/` (desktop)
- [x] Typecheck, svelte-check, 54 unit tests, 22 Playwright tests, check:facts pass
- [x] Opening redone as Dad's notebook on a moonlit workbench: self-drawing lamp sketch, travel doodle, hand-inked title, ticked list, ink stamp, light that fills the screen (DECISIONS #34)
- [x] Main menu redone as paper index tabs in Dad's notebook, with doodles and a pencil arrow; title fits tall phones (DECISIONS #35)
- [x] Screens in `docs/screens/pass5/` (desktop and phone)
- [x] HUD, panels, notebook, goal, tips and place tags moved onto paper; postage-stamp tools (DECISIONS #36)
- [x] Short storybook before a new story (DECISIONS #37)
- [x] Light-switch prompt on the loader; ink-outlined 3D title and clearer pull chain (DECISIONS #38)
- [x] Sculpted hair and shaped bodies for the kids and Mom (DECISIONS #39)
- [x] Resolution governor, frozen-world frame cap, shader warm-up, forgiving jumps, steadier camera, wheel zoom (DECISIONS #40)
- [x] Screens in `docs/screens/pass6/`; typecheck, 56 unit tests, 22 Playwright tests and check:facts pass

## Pass 7 (with Phase 04, at the team's request)

- [x] Desktop-only screenshots; more air in the loader title (DECISIONS #41)
- [x] Hair as one sculpted shell for every character (DECISIONS #43)
- [x] Space mail envelopes, round postal cancellation stamps, mission patches, notebook type and ink colours (DECISIONS #44)
- [x] The mission layer: patches, "Your mission" tab, the dish that listens, and the Phase 05 plan with game references in Game Bible 7.1 (DECISIONS #45)
- [x] Screens in `docs/screens/pass7/` (`scripts/screens-notebook.ts` captures the notebook and the stamp moment)

## Phase 04: Music, sound effects and voices in JavaScript

- [x] Audio Director: six buses, compressor and limiter, room (convolution on Medium and High, echo on Low), cue registry with anti-spam, positional emitters (HRTF, equal power, mono by tier), zone ambience, per-step footsteps by surface, voice ducking, notebook muffle, suspend with the tab (DECISIONS #42)
- [x] Generative, adaptive music on the six-note motif (`src/audio/motif.ts`): Title, Home, Moon, Mars and Finale arrangements; focus pulse; discovery sting on the beat; one layer per co-op friend; the Long Storm (thin, silence, Dad's note); the Finale's statement
- [x] Every effect in the Phase 04 list, each with a comment on how it is built (`src/audio/sfx.ts`)
- [x] Voices: formant babble per character with question rises, Dad's hum or recording, Milo's bleeps, captions as before
- [x] Audio lab at `/audio-lab/` for human review, with an offline loudness and click check and a one-minute recorder
- [x] Mix check: every effect and voice peaks between -8 and -36 dBFS; music peaks between -11 and -18 dBFS; no unintended clicks
- [x] Deployed and smoke-tested live
- Still for people: listen on laptop and phone speakers, and record Dad's lines if a teammate wants to

## Phase 05: The story, the worlds and the puzzles

- [x] Verify every fact (subagent), fill `checkedOn` and `deeper` (54 of 56 checked; `opp-quote-myth` and `sur3-microbe` stay out of the game, DECISIONS #50)
- [x] Content system (`src/content/chapters/`, story director, cards, hints, `chapterStep`)
- [x] Real images and data: eight NASA notebook images with full credits (`scripts/fetch-nasa-images.ts` checks or rebuilds them), Voyager 1 from JPL Horizons (`scripts/fetch-horizons.ts`), bright stars from NASA HEASARC (`scripts/fetch-stars.ts`)
- [ ] Prologue: The Workshop (P0)
- [x] Chapter 1: Tranquility Base (P0): world, three letters, seismograph, Send a Light, Milo's eyes, memory, stamp; `tests/e2e/chapters.spec.ts`; screens in `docs/screens/phase05/` (`npx tsx scripts/screens-chapters.ts`)
- [x] Chapter 3: Meridiani Planum (P0): world, three letters, blueberry grinder, Wait for the Wind, the long storm, last report and calls, Milo's solar heart; playthrough in `tests/e2e/chapters.spec.ts`
- [x] Dad's map: corner map and globe on Home, Tranquility Base and Meridiani Planum (M, click, or LT)
- [x] Speech murmur rebuilt as word-aware formant voices (#55)
- [x] Map design pass: compass corner map that glides with Remi, globe controls and compass, e2e test (#56)
- [x] Performance pass: horizon culling (about 45% fewer triangles), shaders compiled before they show, panel exit motion (#57)
- [x] Foldable mission note (J) and a travel screen for every trip through the Looking Lamp (#58)
- [x] Finale: The Long Light (P0): night on Home, Dad's last letter, the star map with live Voyager 1 data, Milo's record and Dad's saved messages, the projector, the last page, the stamp, the ending and credits, museum free roam; playthrough in `tests/e2e/chapters.spec.ts` (#59)
- [ ] Chapter 2: Hadley-Apennine (P1)
- [ ] Chapter 4: Valinor Hills (P1)
- [ ] Archive cards and the Surveyor 3 bonus chapter (P2)
- [x] Audio pass: recorded foley and instruments, NASA recordings with captions, word-following voices (DECISIONS #49)
- [ ] Writing pass
- [ ] Photo mode, hints, save, museum free roam
- [ ] Automated playthroughs, deploy

## Phase 06: Kid-safe co-op for 1 to 4 players

- [ ] Room state persisted in SQLite
- [ ] Protocol: movement, emotes, phrases, shared progress
- [ ] Lobby, friendly room codes, share link, character select
- [ ] Shared play and puzzle roles
- [ ] Safety and privacy review
- [ ] Free-tier budget checks and solo fallback
- [ ] Tests, deploy

## Phase 07: Polish, QA, final deploy and the submission kit

- [ ] Performance pass
- [ ] Accessibility pass
- [ ] Independent accuracy audit
- [ ] Licensing and safety audit
- [ ] Bug bash
- [ ] Final visual polish
- [ ] Final deploy
- [ ] Submission kit in `docs/submission/`

## Open notes

- `v1-light-day`, `golden-record` and the Surveyor 3 facts rest on secondary sources. Find NASA or JPL primary pages in Phase 05.
- The live URL uses the account's `workers.dev` subdomain. A custom domain would cost money, so it needs a team decision.
