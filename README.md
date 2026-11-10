# Pieces of Home

> Left behind. Still shining.

A cozy 3D browser game for 1 to 4 players. Remi steps inside their late dad's handmade dioramas of real NASA sites, delivers his letters to the machines people left on the Moon and Mars, and rebuilds his unfinished robot, Milo, one engineering lesson at a time.

Our entry for the **NASA Space Apps Challenge 2026**, challenge *Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars*.

**Play:** https://piecesofhome.pages.dev

**Status:** early build. The project skeleton, the co-op room server and the live deploy are in place. The game itself is being built phase by phase. See [docs/PROGRESS.md](docs/PROGRESS.md).

## What it is

- Five little worlds under glass domes on Dad's workbench: Tranquility Base (Apollo 11), Hadley-Apennine (Apollo 15), Meridiani Planum (Opportunity), Jezero Crater (Ingenuity), and the backyard dish pointed at Voyager 1.
- Each world teaches one real idea with your hands: corner-cube mirrors, mesh wheels, solar power and dust, flying in thin air, a message that takes a day to arrive.
- Each lesson becomes a part of Milo.
- No fail states, no timers, no score.

The full design is in [docs/GAME_BIBLE.md](docs/GAME_BIBLE.md).

## How to play

Open the link in a modern browser on a laptop or phone. No install and no account.

Controls, co-op room codes and the Field Guide are described here as they are built.

## Kid safety

No text chat, no voice chat, no usernames, no profiles, no analytics, no trackers, no ads. Co-op uses preset emotes and phrases only, in private rooms.

## Accuracy

Every number, date and claim a player can see comes from [src/data/facts.json](src/data/facts.json), and every fact there has a source link. `npm run check:facts` fails the build if game text uses a fact that is missing, unsourced or not yet verified. The dioramas are labeled "Model, not to scale". Real images carry their exact credit line.

## NASA data and media used

Planned sources, each recorded in [CREDITS.md](CREDITS.md) as it is added:

- NASA Image and Video Library and JPL Photojournal for real photos
- LROC images of the Apollo landing sites
- NASA 3D Resources for hardware reference models
- NASA SVS and USGS Astrogeology for Moon and Mars globe maps
- NSSDCA for landing coordinates and mission facts
- JPL Horizons for Voyager 1's distance and sky position

NASA is credited as a source. NASA does not sponsor or endorse this project. The NASA insignia, logotype and seal are not used.

## Run it yourself

Needs Node 22 or newer.

```bash
npm install
npm run dev          # local dev on http://localhost:5173, with the real Workers runtime
```

| Command | What it does |
|---|---|
| `npm run dev` | Local dev with the Workers runtime and co-op rooms |
| `npm run build` | Fact check, then production build |
| `npm run typecheck` | Type check the browser, Worker and script code |
| `npm run test` | Unit tests (Vitest) |
| `npm run e2e` | Browser smoke and flow tests (Playwright) |
| `npm run e2e:live` | The same smoke tests against the live site |
| `npm run check:facts` | Fail if any used fact lacks a source |
| `npm run deploy` | Build and deploy to Cloudflare |

## Tech

- Vite, TypeScript (strict), Three.js, Svelte 5 for the 2D notebook UI
- Cloudflare Workers with static assets
- Co-op on a `Room` Durable Object per room code (PartyServer), with `partysocket` on the client
- Music and sound made in code with the Web Audio API
- Vitest and Playwright

Why Cloudflare, and other choices, are logged in [docs/DECISIONS.md](docs/DECISIONS.md).

## Credits and license

Code is MIT. See [LICENSE](LICENSE). Assets and libraries are listed in [CREDITS.md](CREDITS.md).

## AI use disclosure

Placeholder, to be completed before submission. This project is built with the help of AI coding tools (Claude Code). The team directs the design, reviews the work and checks every fact against its source. No AI-generated image is presented as a real NASA photo.
