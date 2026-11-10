# Prompts to paste into Claude Code

## 1. Kickoff (paste once)

```
You are building PIECES OF HOME, our NASA Space Apps Challenge 2026 entry for the
"Abandoned but not Forgotten" challenge.

Read CLAUDE.md, then docs/GAME_BIBLE.md and docs/FACT_SHEET.md in full. Then execute
the phase prompts in docs/prompts/ in order, 01 through 07.

Work fully autonomously. We want you to decide everything: stack details, layout,
assets, art, audio, code structure. Log each meaningful decision in
docs/DECISIONS.md and keep docs/PROGRESS.md current. Commit and push small changes
often, and deploy to Cloudflare at the end of every phase.

You are authorized to install skills, npm packages and CLIs, and to download
illustrations, vector graphics, SVGs, raster images, textures, 3D models and fonts,
as long as they follow the licensing rules in CLAUDE.md. Install the latest Taste
Skill and the other skills listed in Phase 01 before building any UI.

Only stop to ask us for browser logins (Cloudflare, GitHub) or anything that costs
money. Use subagents for parallel research, fact checking and independent reviews.
Review your own screenshots after every visual change and keep improving until it
looks premium, warm and handmade, never generic.

There is no time limit. Build everything in the Game Bible, P0 then P1 then P2,
and never cut scope or quality to save time. Start with
docs/prompts/01_setup_skills_and_deploy.md now.
```

## 2. Resume (new session, or after a crash or context reset)

```
Read CLAUDE.md and docs/PROGRESS.md. Check git status and the live URL. Then continue
from the next unchecked item in PROGRESS.md, following the matching prompt in
docs/prompts/. Keep working autonomously.
```

## 3. Optional parallel sessions (after Phase 02 is merged)

Open each in its own git worktree so sessions do not collide, for example
`git worktree add ../poh-audio -b audio` and `git worktree add ../poh-coop -b coop`.

```
Read CLAUDE.md and docs/PROGRESS.md. You own Phase 04 (docs/prompts/04_audio_in_javascript.md)
on this branch. Do not edit files owned by other phases except through the shared
interfaces described there. When done, rebase on main, run all tests, merge, deploy,
and update PROGRESS.md.
```

```
Read CLAUDE.md and docs/PROGRESS.md. You own Phase 06 (docs/prompts/06_coop_multiplayer.md)
on this branch. Coordinate with puzzles only through the solo and coop interface from
Phase 05. When done, rebase on main, run all tests, merge, deploy, and update
PROGRESS.md.
```

## 4. Quick fix requests (any time)

```
Read CLAUDE.md. [Describe the problem or change]. Fix it, add or update a test,
capture before and after screenshots if it is visual, deploy, and note it in PROGRESS.md.
```
