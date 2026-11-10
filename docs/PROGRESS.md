# Progress

There is no deadline. The full scope in the Game Bible gets built: P0, then P1, then P2. Quality is never traded for speed.

- **Live URL:** https://pieces-of-home.tsa-bu.workers.dev
- **Repo:** https://github.com/Vurios/pieces-of-home
- **Team rule for this run:** the agent asks the team before starting each next phase prompt.

**Next up:** Phase 02, `docs/prompts/02_world_engine_and_look.md` (waiting for the team's go-ahead).

## State summary (2026-11-10)

Phase 01 is done. The repo has the full skeleton, 19 skills, a deployed Worker with a `Room` Durable Object, seeded facts with a build check, unit and browser tests, and CI. The page shows a placeholder toon planet and a paper tag. Nothing player-facing is final yet.

Things a new session should know:

- `npm run dev` runs Vite with the real Workers runtime on port 5173. `npm run typecheck` regenerates Worker types first.
- Skills are git-ignored. After a fresh clone run `npx skills experimental_install` to restore them from `skills-lock.json` (`DECISIONS.md` #9).
- Co-op is solo by default. Add `?room=some-code` to open a room socket. The page mirrors state on `<html data-net data-players data-stage>` for tests.
- Playwright runs with 2 workers on purpose (see `DECISIONS.md` #8).
- `scripts/screens.ts` captures the 1440x900 and 390x844 review screenshots into `docs/screens/`.
- Facts: 48 seeded, 27 `checked`, 21 `verify`. No fact has a `checkedOn` date yet. Opening every source is the first job of Phase 05.
- The taste skill ships a Stop hook that only acts if `.taste-skill/build.json` exists. We do not arm it (see `SKILLS.md`).

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
- [x] Public GitHub repo, CI workflow
- [x] Deployed to Cloudflare; live smoke test passes (page, health, room WebSocket, two players counted)
- [x] PROGRESS.md, DECISIONS.md, SKILLS.md, `docs/screens/`

## Phase 02: Tiny-planet engine and the look

- [ ] Study the reference techniques, write our own
- [ ] Engine systems (planet walking, controller, camera, input, interaction, quality tiers)
- [ ] Rendering and art (toon bands, rim light, ink outlines, grading, grain, tilt-shift)
- [ ] Home world, first pass
- [ ] Characters and Milo
- [ ] NASA hardware model pipeline
- [ ] Visual review loop with screenshots
- [ ] Deploy and smoke test

## Phase 03: Loading screen, title sequence and the notebook UI

- [ ] Inline loader (paper, lamp draws itself, "Things that kept working")
- [ ] Title sequence in 3D
- [ ] HUD
- [ ] Notebook
- [ ] Settings
- [ ] Field Guide mode
- [ ] Type and visual system (self-hosted open fonts)
- [ ] Verify, deploy and smoke test

## Phase 04: Music, sound effects and voices in JavaScript

- [ ] Audio Director
- [ ] Generative, adaptive music on the six-note motif
- [ ] Sound effect recipes
- [ ] Voices (gibberish babble, captions)
- [ ] Mix, verify, deploy

## Phase 05: The story, the worlds and the puzzles

- [ ] Verify every fact (subagent), fill `checkedOn` and `deeper`
- [ ] Content system
- [ ] Real images and data (NASA images, Horizons table for Voyager 1)
- [ ] Prologue: The Workshop (P0)
- [ ] Chapter 1: Tranquility Base (P0)
- [ ] Chapter 3: Meridiani Planum (P0)
- [ ] Finale: The Long Light (P0)
- [ ] Chapter 2: Hadley-Apennine (P1)
- [ ] Chapter 4: Valinor Hills (P1)
- [ ] Archive cards and the Surveyor 3 bonus chapter (P2)
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
