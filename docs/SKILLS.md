# Skills

Installed into `.claude/skills/` on 2026-11-10 with `npx skills add ... -a claude-code -y`. Versions are pinned in `skills-lock.json`. Each SKILL.md was read before use.

The Game Bible wins over any skill. Where a skill and the Bible disagree, the rule we ignore is listed below.

## design-taste-frontend (tasteskill 2.5.1)

Source: `Leonxlnx/taste-skill`.

**What it is for here:** craft rules for every DOM surface: the loading page, title overlay, notebook menus, settings, the Field Guide, About and Credits. We take its anti-slop checks, typography and spacing discipline, copy rules (plain words, headings that name things, buttons as a verb and an object), hover and press feedback, reduced-motion handling, contrast, tap sizes and keyboard access.

**Rules we ignore, and why:**

- The whole "kind of business" page plan, dealt heroes, dealt palettes, navs, footers and "one section per screen". It builds company marketing sites. Our DOM is a game UI drawn as Dad's notebook (Game Bible sections 9 to 11).
- "Real photographs lead" and stand-in stock photographs. Our only photographs are real NASA images with exact credits. No stock, ever.
- House rule 1, no caption under any image. Our rules require the opposite: every real image carries its exact credit line as a museum label, and every diorama says "Model, not to scale".
- Its starter kit, shader grounds, `fx-*` parts, scenes and moments. We write our own notebook components so the look stays handmade.
- The finish gate (`gate.mjs`) and its Stop hook. The hook only acts when a `.taste-skill/build.json` exists. We never arm it, because the gate checks for a marketing page shape we do not have. `.taste-skill/` is git-ignored.
- "No violet or lavender". Lumi's hoodie is lavender and Home's dusk is indigo, both set by the Bible. We still avoid purple-blue tech gradients, as the Bible says.

**Scripts it ships:** `scripts/*.mjs` (gate, consistency, copy-lint, shoot, perf, photos, icons, start, moments, effects) and `assets/**/check.mjs`. They run a local headless Chrome against a page. We may run `copy-lint.mjs`, `perf.mjs` and `shoot.mjs` on the Field Guide and About pages, which are plain documents. Read each script before its first run.

## frontend-design (Anthropic)

Source: `anthropics/skills`.

**What it is for here:** picking a point of view before building any UI. Plan tokens first (color, type, layout, principles), check the plan against generic defaults, spend boldness in one place, write copy from the player's side.

**Rules we ignore, and why:**

- It warns that warm cream paper with a clay accent is a common generated look. The Bible sets paper `#F4ECDD` and roof clay on purpose, as the fiction of Dad's notebook. We keep the palette and earn it with real texture: engineering grid, ink boil, tape, stamps, handwriting. No serif-display-on-cream template look.
- "Avoid all caps for labels." Ink stamps (LEFT BEHIND. STILL ANSWERING.) and museum tags are all caps by design. Everything else stays sentence case.

## webapp-testing (Anthropic)

Source: `anthropics/skills`.

**What it is for here:** the habit of looking at the real page: wait for the app to settle, screenshot, read console logs, then act.

**Rules we ignore, and why:**

- It writes Python Playwright scripts and ships `scripts/with_server.py`. Our stack is TypeScript, so tests use `@playwright/test` (`npm run e2e`) and screenshots use `scripts/screens.ts`. Playwright's own `webServer` setting replaces the Python helper. The Python scripts are not run.

## Three.js skills (cloudai-x/threejs-skills)

Thirteen reference skills: `threejs-fundamentals`, `-geometry`, `-materials`, `-lighting`, `-textures`, `-shaders`, `-postprocessing`, `-animation`, `-interaction`, `-loaders`, `-asset-pipeline`, `-performance`, `-react-three-fiber`.

**What they are for here:** API reference while building the world engine. Most used: materials and shaders (toon bands, rim light), postprocessing (ink outlines from depth and normals, grading, grain, tilt-shift), performance (instancing, draw calls, phone budgets), asset-pipeline (shrinking NASA GLB models with gltf-transform), loaders and animation.

**Rules we ignore, and why:**

- `threejs-react-three-fiber`: not used. We have no React. It was installed with the pack and is left alone.
- WebGPU and TSL paths: we target WebGL2 so school laptops and mid phones work. Logged in `DECISIONS.md`.
- Physically based lighting advice gives way to the Bible's toon look.

Not installed: `majidmanzarpour/threejs-game-skills`. It is optional in the Phase 01 prompt, and the thirteen skills above already cover our needs. Revisit in Phase 02 if the world engine needs it.

## Cloudflare skills (official, `cloudflare/skills`)

Installed because the repo belongs to the `cloudflare` GitHub organization: `durable-objects`, `workers-best-practices`, `wrangler`.

**What they are for here:** the co-op Room (one Durable Object per room code, SQLite storage, hibernating WebSockets, persist first and cache second), Worker config (compatibility date, observability, generated `Env` types with `wrangler types`), and deploy commands. They say to prefer fetching the current Cloudflare docs over memory, and we follow that.

**Rules we ignore, and why:**

- "Use RPC methods, not the fetch handler" for Durable Objects. PartyServer routes WebSocket upgrades through the object's fetch path for us. That is the tech default in `CLAUDE.md`.
- Traces are left off for now. Workers Logs are on. We keep free-tier use small.
