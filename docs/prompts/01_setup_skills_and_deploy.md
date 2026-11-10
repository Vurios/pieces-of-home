# Phase 01: Setup, skills, scaffold and first deploy

**Goal:** a working repo with the right skills installed, the full project skeleton, a live Cloudflare URL with a WebSocket room that connects, and the docs that let any later session resume.

Read `CLAUDE.md`, `docs/GAME_BIBLE.md` and `docs/FACT_SHEET.md` first. Work autonomously. Only stop for browser logins.

---

## 1. Check the machine

- Confirm Node 22 or newer, npm, git, and a Chrome or Chromium install (the taste skill's checker and Playwright need one). Install anything missing.
- `gh auth status`. If not logged in, ask the human to run `gh auth login` and wait.
- `npx wrangler@latest whoami`. If not logged in, run `npx wrangler login` (it opens a browser for the human to approve) and wait. If the team prefers tokens, accept `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment instead.
- Never upgrade any paid plan.

## 2. Install skills

Install these into the project for Claude Code, read each SKILL.md, and write `docs/SKILLS.md` noting what each one is for in this project and any rule you will ignore because the Game Bible overrides it.

1. **Taste Skill (latest, anti-slop design).** Current install name is `design-taste-frontend` (tasteskill 2.5.x at time of writing).
   - `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend" -a claude-code -y`
   - If the CLI flags differ, run `npx skills --help` and adapt. Fallback: clone the repo and run its `install.sh`, or ask the human to run `/plugin marketplace add Leonxlnx/taste-skill` then `/plugin install taste-skill@taste-skill`.
   - How we use it: for every DOM surface (loading page, title overlay, menus, notebook, settings, Field Guide, About and Credits pages). It is built for websites, so apply its anti-slop rules, typography, spacing and motion craft, but keep our Game Bible look (Dad's notebook, ink and paper) rather than a marketing-page layout. Use its headless checker on DOM pages if available.
2. **Anthropic frontend-design** (distinctive UI direction): `npx skills add https://github.com/anthropics/skills --skill frontend-design -a claude-code -y`
3. **Anthropic webapp-testing** (Playwright verification and screenshots): `npx skills add https://github.com/anthropics/skills --skill webapp-testing -a claude-code -y`
4. **Three.js knowledge:** `npx skills add https://github.com/cloudai-x/threejs-skills -a claude-code -y`. Optionally also look at `majidmanzarpour/threejs-game-skills` and install only the parts that do not conflict with our architecture.
5. Search for an official Cloudflare skill for Workers or Durable Objects. Install it only if it comes from the `cloudflare` GitHub organization.

If newly installed skills do not show up in your skill list, either ask the human to restart Claude Code once, or read each SKILL.md directly and follow it. Do not stall on this.

## 3. Hosting decision (already made: Cloudflare)

Record this in `docs/DECISIONS.md` as decision #1, with the sources from `docs/FACT_SHEET.md` section 4:

- **Cloudflare Workers with static assets plus Durable Objects**, not Vercel.
- Why: a 3D game ships many megabytes per visitor. Cloudflare serves static asset requests free and unlimited, from its global network, while Vercel Hobby includes 100 GB of transfer per month and is for non-commercial use. Co-op needs one stateful server per room: a Durable Object per room code holds the shared notebook, Milo and puzzle state and keeps WebSockets open, on the free plan. Vercel Functions can hold WebSockets but close them at the function's maximum duration and need an external store for shared room state. One Cloudflare deploy serves the game and its multiplayer from the same URL.
- Limits to respect: 25 MiB per static file, 20,000 files per version on Free, 100,000 Worker requests per day on Free (static asset requests do not count), Durable Object free daily limits (when exceeded, operations fail, so the game must fall back to solo).

## 4. Scaffold the project

Create a Vite + TypeScript (strict) + Svelte 5 + Three.js app with a Cloudflare Worker, using `@cloudflare/vite-plugin` so `npm run dev` runs the real Workers runtime locally.

Suggested layout (adjust if you find better, and log why):

```
src/
  main.ts                 boot: loader handoff, renderer, app state
  game/                   engine: planet, controller, camera, input, interaction, worlds, render, quality
  game/worlds/            home, tranquility, hadley, meridiani, valinor, finale
  game/puzzles/           one module per main activity, each with solo and co-op modes
  audio/                  audio director, music, sfx recipes, voices
  net/                    co-op client (partysocket), protocol types shared with worker
  ui/                     Svelte components: loader bridge, title menu, HUD, notebook, settings, lobby
  content/                chapters, letters, dialogue, notebook pages, Milo stages (typed data)
  data/                   facts.json, credits.json, voyager1.json, strings.en.json
  worker/                 Cloudflare Worker entry and the Room Durable Object (PartyServer)
public/                   static assets (models, textures, images, fonts)
scripts/                  asset pipeline, fetch-nasa-images, fetch-horizons, check-facts
tests/                    vitest unit tests, playwright e2e
docs/                     bible, facts, prompts, progress, decisions, skills, screens
```

Wrangler configuration (`wrangler.jsonc`), conceptually:

- `name`: `pieces-of-home`
- a recent `compatibility_date`
- `assets`: the built client directory, with single-page-app not-found handling, and run the Worker first only for `/parties/*` and `/api/*`
- `durable_objects.bindings`: a `Room` binding to class `Room`
- `migrations`: tag `v1` with `new_sqlite_classes: ["Room"]` (the Free plan only allows SQLite-backed Durable Objects)

Worker and room stub:

- Install `partyserver` and `partysocket`. Implement a minimal `Room` that accepts connections, keeps a player count, echoes a hello, and enables hibernation.
- Add `GET /api/health` returning version and time.

Static headers: hashed assets cached for a year (immutable), `index.html` not cached.

Other setup:

- Scripts: `dev`, `build`, `preview`, `test`, `e2e`, `check:facts`, `deploy` (build then `wrangler deploy`), `typecheck`.
- Vitest and Playwright installed and configured. The first Playwright test opens the page, waits for the canvas, and checks that a room WebSocket connects.
- `index.html` contains a temporary inline paper-colored loader placeholder (the real one comes in Phase 03).
- `src/data/facts.json` seeded from `docs/FACT_SHEET.md` with fields: `id`, `kid`, `deeper`, `value`, `date`, `sourceTitle`, `sourceUrl`, `status` (`checked` or `verify`), `checkedOn`. `scripts/check-facts.ts` fails the build if a fact used by the game has no source or still has status `verify`, or if any content file references a missing fact ID.
- `README.md` skeleton (what, how to play, how to run, NASA data used, tech, credits, AI use disclosure placeholder). `LICENSE` (MIT for code). `CREDITS.md`.

## 5. GitHub and first deploy

- Create a **public** GitHub repo (Space Apps asks for public code). Name: `pieces-of-home` unless the human set another name in PROGRESS.md. Push.
- Deploy: `npm run deploy`. Record the `*.workers.dev` URL in PROGRESS.md and README.
- Smoke-test the live URL with Playwright: page loads, `/api/health` responds, a room WebSocket connects.
- Optional CI: a GitHub Actions workflow that runs typecheck, unit tests and the fact check on every push. Add a deploy job on `main` only if a `CLOUDFLARE_API_TOKEN` secret exists; otherwise keep deploying locally.

## 6. Docs for resuming

Create:

- `docs/PROGRESS.md`: a note that there is no deadline and the full scope gets built, the live URL, the repo URL, a checklist of Phases 01 to 07 with sub-items, and a "Next up" line.
- `docs/DECISIONS.md` with decision #1 (hosting) and anything else you decided.
- `docs/SKILLS.md`.
- `docs/screens/` (empty for now).

## Definition of done

- [ ] Skills installed and documented
- [ ] Repo public on GitHub, CI green
- [ ] Live URL on Cloudflare; health endpoint works; a room WebSocket connects in production
- [ ] `facts.json` seeded; `npm run check:facts` runs
- [ ] PROGRESS.md, DECISIONS.md, SKILLS.md written
- [ ] Commit, push, then continue straight to `docs/prompts/02_world_engine_and_look.md`
