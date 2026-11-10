# START HERE: Pieces of Home prompt pack

This folder becomes your project. Claude Code reads it and builds the game.

## What's inside

| File | Who reads it | What it is |
|---|---|---|
| `START_HERE.md` | You | This guide |
| `KICKOFF.md` | You | The exact prompts to paste into Claude Code |
| `CLAUDE.md` | Claude Code (auto-loaded every session) | Standing rules: autonomy, accuracy, licensing, kid safety, quality bar, tech defaults |
| `.claude/settings.json` | Claude Code | Lets it run npm, git, wrangler and so on without asking each time. Delete it if you prefer to approve every command |
| `docs/GAME_BIBLE.md` | Everyone | The improved concept: story, chapters, art, audio, co-op, scope |
| `docs/FACT_SHEET.md` | Everyone | Checked facts with sources, plus the ones Claude Code must verify |
| `docs/prompts/01` to `07` | Claude Code | One self-contained prompt per build phase |

## Setup

1. Install **Node 22+**, **Git**, **Google Chrome**, and **Claude Code**. Sign in to Claude Code.
2. Create free accounts: **GitHub** (and install the `gh` CLI) and **Cloudflare**.
3. Log in once so it won't block you later: `gh auth login` and `npx wrangler login`.
4. Decide who does what (roles below) and fill in your team names.
5. Read the Game Bible together. Edit anything you want to change.

## Start building

1. Make an empty folder, for example `pieces-of-home`, and unzip this pack into it.
2. Open a terminal in that folder and run `claude`.
3. Paste prompt 1 from `KICKOFF.md`.
4. Approve the browser logins if asked. Then let it run.

## While it builds

- Watch `docs/PROGRESS.md` for status and the live URL, `docs/DECISIONS.md` for choices, and `docs/screens/` for screenshots.
- After Phase 02 lands, you can speed things up with two extra Claude Code sessions in git worktrees for audio (04) and co-op (06). See `KICKOFF.md` section 3.
- If a session runs out of context or crashes, start a new one and paste the Resume prompt.

## Suggested roles for a team of up to six

| Role | Job |
|---|---|
| Director | Plays every build, reviews screenshots, decides when "good" is good enough |
| Fact checker | Opens every source in `facts.json`, especially the "Verify" rows |
| Writer | Polishes Dad's letters and lines, kid dialogue, the For grown-ups note; reviews the Filipino translation |
| Art and UX reviewer | Compares screenshots to the art direction, flags anything generic |
| Audio and voice | Reviews the `audio-lab` page; optionally records Dad's lines |
| Presenter | Owns the 30-second video, the 7 slides and the project page |

## Hosting: why Cloudflare, not Vercel

- A 3D game sends many megabytes to each visitor. Cloudflare serves static asset requests free and unlimited; Vercel's free Hobby plan includes 100 GB of transfer per month and is for non-commercial use.
- Co-op needs a small server per room that keeps WebSockets open and remembers the shared notebook and Milo. Cloudflare Durable Objects do exactly that, on the free plan. Vercel can hold WebSockets but closes them at the function's time limit and needs an external store to share room state.
- One deploy on Cloudflare serves the game and its multiplayer from the same URL.

## Submission checklist (Phase 07 prepares these)

- [ ] Live URL works on desktop and phone
- [ ] Public GitHub repo with README, credits and AI use disclosure
- [ ] 30-second video uploaded publicly (or 7 slides)
- [ ] Project page text pasted into the Space Apps submission form
- [ ] Every fact verified, every image credited
