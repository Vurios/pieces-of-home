# CLAUDE.md: standing rules for every session

Project: **Pieces of Home**, our NASA Space Apps Challenge 2026 entry for "Abandoned but not Forgotten". A cozy 1 to 4 player browser game in a Messenger-like tiny-planet style. Kids deliver a late father's letters to the machines NASA left on the Moon and Mars and rebuild his robot, Milo.

## Read order at the start of every session

1. This file
2. `docs/PROGRESS.md` (create it in Phase 01 if missing)
3. `docs/GAME_BIBLE.md` (creative source of truth)
4. `docs/FACT_SHEET.md` (facts and sources)
5. The current phase prompt in `docs/prompts/`

## Autonomy

- The team has asked you to make every decision yourself. Do not stop to ask questions. Choose the best option, act, and log meaningful decisions in `docs/DECISIONS.md` (date, decision, why, alternatives considered).
- Only stop and ask a human for: (1) logins that need a person in a browser (`npx wrangler login`, `gh auth login`), (2) anything that costs money or changes billing, (3) deleting or rewriting anything outside this project folder.
- Move through the phases in order without waiting for approval. Keep `docs/PROGRESS.md` current so anyone can see where things stand.
- You may install skills, npm packages, CLIs and download assets as needed, following the licensing rules below. Read a skill's SKILL.md and any scripts it ships before running them.
- Use subagents for parallel research (assets, fact verification) and for independent reviews.

## Source of truth, in order

1. `docs/GAME_BIBLE.md` for story, design, art, audio
2. `docs/FACT_SHEET.md` and `src/data/facts.json` for every number, date and claim
3. Installed skills (taste-skill, frontend-design, Three.js skills) for craft
4. Your own judgment

## Accuracy

- Every number, date and factual claim a player can see comes from `src/data/facts.json`, and every fact there has a source URL. Never invent a fact. If you cannot verify one, remove the claim from the game and log it.
- Dioramas are labeled "Model, not to scale". Real images carry their exact credit line.
- Live facts (Voyager 1 distance) are date-aware.

## Licensing and IP

- Our code is MIT. Allowed assets: NASA media (credit it), CC0, SIL OFL fonts, MIT/BSD/Apache/ISC libraries. Record every asset in `CREDITS.md` and `src/data/credits.json` with source URL and license.
- The reference repo `github.com/arafays/messenger-copy` is for studying techniques only. Never copy anything from its `reference/` folder or any Abeto asset: models, textures, audio, fonts, extracted shaders or UI art. Write original implementations of standard techniques.
- Never use the NASA insignia ("meatball"), logotype ("worm") or seal. Never imply NASA endorsement.
- No AI-generated images made to look like real NASA photos. Illustrations must read as illustrations.

## Kid safety and privacy

No text chat, no voice chat, no usernames, no profiles, no analytics, no trackers, no ads, no third-party embeds that track. Co-op uses preset emotes and phrases only.

## Player-facing copy

Short sentences. Reading level around grade 3 to 5 (Deeper notes can go higher). Warm and plain. **No em dashes.** Captions for every spoken line. Dad's voice follows the guide in the Game Bible, section 5.7.

## Quality bar

- **Look:** follow the Game Bible art direction. After every visual change, capture Playwright screenshots at 1440x900 and 390x844, look at them, and fix anything that looks generic or off-style before moving on. Save the latest set in `docs/screens/`.
- **Performance:** first playable download under 8 MB; each world under 4 MB; 60 fps on a mid laptop; steady 30 fps on a mid phone.
- **Health:** typecheck, unit tests and the Playwright smoke test pass. Zero console errors.

## Workflow

- Small commits with clear messages. Push to GitHub. `main` stays deployable.
- Deploy to Cloudflare at the end of every phase (`npm run deploy`) and smoke-test the live URL.
- Before your context gets long, write a short state summary into `docs/PROGRESS.md`.
- There is no deadline. Build everything in P0, then P1, then P2 (Game Bible section 16). Never cut scope or lower quality to save time; finish each tier to the quality bar before starting the next.

## Tech defaults (change only with a logged reason)

- Vite, TypeScript (strict), Three.js (latest), Svelte 5 for the 2D UI layer (not SvelteKit)
- Cloudflare Workers with static assets, `@cloudflare/vite-plugin`, Wrangler v4
- Co-op: PartyServer Durable Object `Room` (SQLite-backed) and `partysocket` on the client
- Audio: Web Audio API (Tone.js allowed for music), ZzFX allowed for SFX
- Tests: Vitest and Playwright
- Do not upgrade any Cloudflare or Vercel plan. Stay on free tiers.

## Commands (keep these working)

- `npm run dev` local dev with the Workers runtime
- `npm run build`
- `npm run test` unit tests
- `npm run e2e` Playwright smoke and flow tests
- `npm run check:facts` fails if any fact lacks a source or any text references a missing fact
- `npm run deploy` build and deploy to Cloudflare
