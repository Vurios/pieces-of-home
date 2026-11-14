# Pieces of Home: context for a new Claude Code session

Paste this file (or point Claude Code at it) at the start of a session, for example in Claude Code on the web. It explains what the game is, why it exists, how it is built, the rules the team works by, and where things stand. The repo's own `CLAUDE.md` holds the standing rules and wins if anything here disagrees.

- **Repo:** https://github.com/Vurios/pieces-of-home (public, branch `main`)
- **Live game:** https://piecesofhome.pages.dev
- **State as of:** 2026-11-14

---

## 1. The challenge

- **Event:** NASA International Space Apps Challenge 2026. NASA lists the 2026 hackathon weekend as November 14 to 15, 2026.
- **Challenge, as recorded in the team's brief (`KICKOFF.md`, `docs/GAME_BIBLE.md`):** *Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars.* We could not find the official challenge page in a quick web search, so check the exact title and wording on spaceappschallenge.org before quoting it anywhere public.
- **What it asks for, in short:** tell the story of the hardware people left on the Moon and Mars (landers, rovers, experiments, a helicopter), why it was left, and what some of it still does for science today.
- **How Space Apps judges (2025 guide; confirm for 2026):** Impact, Creativity, Validity, Relevance, Presentation. Game Bible section 17 maps the game to each one.
- **Team rule:** the game never names the challenge or the hackathon in anything a player sees. The NASA disclaimer lives only in Credits. Never use the NASA insignia, logotype or seal, and never imply NASA endorsement.

## 2. The game in one paragraph

**Pieces of Home** is a cozy 1 to 4 player browser game in a tiny-planet style (think of a small round world you walk around). Remi (11, they/them) opens their late dad's workshop for the first time since he died. Dad built small things that kept working: a desk lamp that switches itself on every evening, an unfinished robot called Milo, and glass domes holding little model worlds of real NASA sites. He also wrote letters he never sent, each addressed to a machine left on the Moon or Mars. Remi steps into each little world, delivers the letters, plays with the idea that made each machine work, and gives Milo a new part. Every world ends with a stamp: *Left behind. Still ___.* The finale points Dad's backyard dish at Voyager 1 with live, date-aware distance data. Tagline: **Left behind. Still shining.**

### Worlds, machines and Milo's parts

| World | Real site | Machine | The idea you play | Milo part | Stamp |
|---|---|---|---|---|---|
| Prologue | Home, Dad's workshop | Dad's self-switching lamp | A machine can keep working after its maker leaves | Lamp head | LEFT ON. STILL SHINING. |
| Chapter 1 | Tranquility Base, Moon (Apollo 11) | Laser ranging retroreflector | Corner mirrors send light straight back | Corner-cube eyes | STILL ANSWERING |
| Chapter 2 | Hadley-Apennine, Moon (Apollo 15) | Lunar Roving Vehicle | Mesh wheels, rear steering | Mesh wheels | STILL SHOWING THE WAY |
| Chapter 3 | Meridiani Planum, Mars (Opportunity) | Opportunity rover | Solar power, dust and lucky wind | Solar heart | STILL TEACHING |
| Chapter 4 | Valinor Hills, Jezero, Mars (Ingenuity) | Ingenuity helicopter | Flying in very thin air | Rotor | STILL KEEPING NOTES |
| Bonus | Ocean of Storms, Moon (Surveyor 3) | Surveyor 3 | Parts brought home and studied | Scoop arm | (see content) |
| Finale | Home at night | Voyager 1 and its Golden Record | A message carried far from home | Golden-record voice | NOT LEFT BEHIND. STILL SENDING. |

Friends Nori, Lumi and Theo give hints. Mom waits on the porch. There are no fail states and no timers.

### Project details at a glance

- **Main goal (the heart of the game):** help players learn about the machines people left on the Moon and Mars, and why they are not forgotten. The story (Dad's letters, Milo, the workshop) is the way in; every chapter is built around one real machine, what it did, why it stayed behind and what it still does or taught us. Each true story card shows the real machine's name, a sourced fact, a "More about it" panel (when, where, the facts) and its source.
- **Who it is for:** ages **8 to 12** is the best fit (about grades 3 to 7). The reading level is grade 3 to 5, the controls are simple, there are no fail states, and the story deals gently with loss. The Game Bible's primary band is 8 to 13; younger players (6 to 7) can play with a grown-up reading along. Secondary audience: teachers and parents, families playing together (1 to 4 player co-op), space fans and the judges.
- **Where to play:** a laptop or desktop with a keyboard and mouse (Chrome, Edge, Firefox or Safari). Phones and small touch screens get a friendly "Best on a computer" note with a "Play anyway" button.
- **Length:** the Game Bible aims for 30 to 40 minutes for the whole story, 6 to 10 minutes a chapter, with the first real NASA fact within 3 minutes. Progress saves on the device.
- **Kid safety:** no text or voice chat, no usernames, no accounts, no ads, no tracking. Co-op uses private room codes, preset emotes and phrases.
- **Format:** free, in the browser, nothing to install. Open source (MIT code; NASA media credited; CC0 and SIL OFL assets).

## 3. Rules that always apply (from `CLAUDE.md` and the team)

- **Accuracy:** every number, date and claim a player sees comes from `src/data/facts.json`, and every fact there has a source URL. Never invent a fact; if one cannot be verified, remove the claim and log it. `npm run check:facts` gates the build. Dioramas are labeled "Model, not to scale". Real NASA images carry their exact credit line.
- **Licensing:** our code is MIT. Allowed assets: NASA media (credited), CC0, SIL OFL fonts, MIT/BSD/Apache/ISC libraries. Record every asset in `CREDITS.md` and `src/data/credits.json`. The reference repo `github.com/arafays/messenger-copy` is for studying techniques only: never copy anything from its `reference/` folder or any Abeto asset. No AI images that look like real NASA photos.
- **Kid safety and privacy:** no text or voice chat, no usernames, profiles, analytics, trackers, ads or tracking embeds. Co-op uses preset emotes and phrases only.
- **Player copy:** short sentences, reading level about grade 3 to 5, warm and plain. **No em dashes.** Captions for every spoken line. Dad's voice follows Game Bible section 5.7. English only (no language setting, ever).
- **Look:** follow the Game Bible art direction (warm toon shading, ink outlines, paper UI in Dad's notebook style, navy "Dad ink" `#233F73`). Layouts are roomy; props never sit on paths. After a visual change, take Playwright screenshots at **1440x900, desktop only**, look at them, and fix anything generic before moving on.
- **Performance:** first playable download under 8 MB (now about 6 MB), each world under 4 MB, 60 fps on a mid laptop, 30 fps on a mid phone.
- **Health:** typecheck, unit tests and the Playwright tests pass, with zero console errors.
- **Workflow:** small commits with clear messages, `main` stays deployable, log meaningful choices in `docs/DECISIONS.md` (date, decision, why, alternatives), keep `docs/PROGRESS.md` current. Never cut scope or lower quality to save time.
- **Ask a human for:** browser logins (`npx wrangler login`, `gh auth login`), anything that costs money or changes billing (stay on free tiers), and deleting anything outside the project folder.
- **On hold:** the submission kit (`docs/submission/`) waits until the team asks. README.md is the only outward doc for now.

## 4. Tech

- Vite 8, TypeScript (strict), Three.js r187 (WebGL2, custom toon shader and our own post pipeline), Svelte 5 for the 2D UI (not SvelteKit).
- Cloudflare: Worker with static assets plus a PartyServer Durable Object `Room` (SQLite) for co-op; `partysocket` on the client. Pages deploy for the public URL (`npm run deploy` does both).
- Audio: Web Audio API, generative music on a six-note motif, synthesized effects, recorded foley and NASA recordings with captions.
- Tests: Vitest (unit) and Playwright (e2e, 2 workers, SwiftShader software WebGL).

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite with the real Workers runtime on port 5173 |
| `npm run build` | `check:facts`, then the production build |
| `npm run typecheck` | Wrangler types, svelte-check, Worker and Node tsconfigs |
| `npm run test` | Unit tests (through `scripts/vitest.mjs`) |
| `npm run e2e` | Playwright smoke, flow, chapter and co-op tests |
| `npm run check:facts` | Fails if a fact lacks a source or text points at a missing fact |
| `npm run deploy` | Build and deploy to Cloudflare (needs `wrangler login`, a human step) |

Skills are git-ignored. After a fresh clone, `npx skills experimental_install` restores them from `skills-lock.json`.

### Where things live

- `index.html`: the loading page (inline CSS and a tiny script), filled in at build time by `scripts/vite/loader-plugin.ts`, `loader-book.ts` and `loader-art.ts`. Its words are in `src/content/loader.ts`.
- `public/loader/workshop.webp`: the loader's picture of the workshop, rendered by the game itself with `npx tsx scripts/render-backdrop.ts` (needs `npm run dev` and a GPU). Rerun it whenever the workshop or the title's first camera changes.
- `src/main.ts`: boot, progress milestones, the handoff from the loader to the 3D title.
- `src/game/engine.ts`: the loop, worlds, title, story shots, travel, shader warm-up. `core/` (events, input, quality, state, `yield.ts`), `world/` (sphere math, terrain, controller, camera), `render/` (toon, post, kit batching, sky, trip), `actors/`, `title/`, `worlds/` (home plus one folder per chapter world), `puzzles/`.
- `src/ui/`: Svelte UI. `App.svelte`, `title/` (TitleScreen, Menu, StoryIntro), `notebook/`, `hud/`, `panels/`, `story/` (cards and station games), `map/`.
- `src/content/`: all player copy (chapters, story, places, goals, loader).
- `src/data/facts.json`: every fact with its source.
- `docs/`: `GAME_BIBLE.md` (creative source of truth), `FACT_SHEET.md`, `DECISIONS.md` (numbered log, now past 94), `PROGRESS.md`, `prompts/01` to `07` (phase prompts), `screens/` (latest screenshots).

### Handy URL switches and test hooks

- A plain visit plays the real intro. `?test`, `?shot` and `?skip` jump straight into play; add `?intro` to run the intro in tests.
- `?quality=low|medium|high`, `?debug` (fps overlay), `?world=tranquility` (with `?test`), `?room=<code>` for co-op, `?shot=<bookmark>` for fixed camera screenshots.
- With `?test`, `window.__poh` exposes hooks: `state()`, `teleportTo(id)`, `travel(id)`, `patch({...})`, `titlePhase()`, `programs()` (compiled shaders), `lights()`, `unveil()`, co-op hooks and more (see `engine.debugApi()` and `main.ts`).
- The page mirrors state on `<html data-stage data-net data-players data-tier>` for tests.

### Screenshot and measuring scripts (need `npm run dev`)

- `npx tsx scripts/screens-loader.ts [folder]`: the loading page and the handoff into 3D, frame by frame.
- `npx tsx scripts/screens-story.ts [folder]`: the storybook before a new story.
- `npx tsx scripts/screens.ts`, `screens-intro.ts`, `screens-chapters.ts`, `screens-notebook.ts`: the rest of the game.
- `npx tsx scripts/perf-boot.ts [url] [outdir] gpu`: long tasks and frame gaps from first paint through the story, with `PROFILE=1`, `KEYS=1` or `LIGHTS=1` for detail.

## 5. The opening, as it is now

1. **Loading page:** Dad's leather notebook rises in his dark, moonlit workshop and swings open. The workshop behind it is a picture the game rendered of itself, lined up with the first frame of the title flight. Left page: Dad's sketch of his lamp draws itself with the real loading progress, with his notes and a doodle of a letter flying home, Moon, Mars. Right page: the block-letter title (the same letters as the 3D title), "Things that kept working" ticked off in red pencil (each line a sourced fact), then a wall light switch: "Turn on the light".
2. **The switch:** the notebook closes and drops away, the room comes into focus, the live 3D workshop takes the picture's place with no seam, and Dad's lamp flickers on in 3D. Then the camera pulls back out of the workshop to the planet, the title letters drop in, and the player pulls the chain (BEGIN).
3. **New story:** a short storybook over the live world. Six shots, each with its own slow camera move, words on a torn notebook page that ink in word by word beside a self-drawing doodle, and a sheet of grid paper that sweeps across like a turning page between shots. Then "Your adventure" explains the goal, and play begins.

## 6. Performance notes (learned the hard way)

- Every scene is drawn into the post pipeline's linear render target. Compile shaders **inside** that target (`PostPipeline.withSceneTarget`), or the warm-up builds sRGB programs the game never uses and the real ones compile mid-play with a stall.
- **Never change the number of lights** in the scene during play: every material recompiles. When the title goes away, a dark stand-in light takes its place (`engine.spareLight`).
- The model kit caches a stripped copy of each source shape (`render/kit.ts`); do not go back to cloning geometry per piece (cloning a sphere first builds a default sphere).
- World builds are async and yield between slices (`core/yield.ts`), so the loading page keeps moving.
- The trip's shaders compile before the light is switched on, not during the title flight.
- Measured on an RTX 4050 laptop: title flight went from 6 to 9 hitches of 90 to 220 ms to none; the stall when a new story starts went from about 0.95 s to under 0.1 s.

## 7. Where things stand and what is next

Phases 01 to 06 are done and deployed. Phase 07 (polish, QA, final deploy) is under way; team feedback passes 3 and 4 are done. Still open in Phase 07:

- Performance pass on a real mid laptop and a mid phone
- Accessibility pass
- Independent accuracy audit
- Licensing and safety audit
- Bug bash and final visual polish
- Final deploy and live smoke test
- Submission kit only when the team asks

Check `docs/PROGRESS.md` and the latest entries in `docs/DECISIONS.md` before starting anything.

## 8. Working from Claude Code on the web

- The cloud sandbox has no graphics chip. WebGL runs in software (SwiftShader), so the game is slow there and GPU-only scripts (`render-backdrop.ts`, the `gpu` mode of `perf-boot.ts`, `screens-loader.ts`, `screens-story.ts`) will not give real timings. The Playwright suite already runs on SwiftShader.
- `npm run deploy` needs a Cloudflare login in a browser, which a web session cannot do. Push a branch or open a pull request and let a teammate deploy from a laptop.
- Keep to the rules in section 3, keep commits small, and update `docs/PROGRESS.md` and `docs/DECISIONS.md` with anything meaningful.
