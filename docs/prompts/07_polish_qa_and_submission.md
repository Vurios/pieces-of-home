# Phase 07: Polish, QA, final deploy and the submission kit

**Goal:** a fast, bug-free, accessible, accurate game on a stable URL, plus everything the team needs to submit to Space Apps: README, credits, AI disclosure, a 30-second video, a 7-slide outline and the project page text.

Read `CLAUDE.md` and Game Bible sections 13, 14, 16 and 17.

---

## 1. Performance pass

- Measure first-load size, time to the "Turn on the light" prompt, and fps per world on High, Medium and Low tiers (use Playwright with CPU throttling and a mobile viewport for the Low case).
- Hit the budgets: first playable under 8 MB, each world under 4 MB, 60 fps on a mid laptop, steady 30 fps on a mid phone.
- Tools: meshopt or Draco geometry, KTX2 or WebP textures, texture atlases, instancing or batching for repeated props, lazy world chunks, preloading the next world during the notebook or a transition, disposing old worlds.
- Confirm no single static file exceeds 25 MiB and the file count stays well under 20,000.

## 2. Accessibility pass

- `axe-core` on every DOM surface; fix all serious issues.
- Full keyboard-only playthrough, gamepad-only playthrough, and touch-only playthrough on a phone viewport (portrait and landscape).
- Check subtitles, text size, reading font, high contrast, reduced motion, colorblind-safe puzzle cues, read-aloud, and the Field Guide with a screen reader flow (headings, landmarks, alt text with credits).

## 3. Accuracy audit (independent)

- Spawn a subagent that has **not** seen the game copy. Give it `src/data/facts.json` only and have it re-check every fact against its source URL, reporting mismatches.
- Then have it read every player-facing string and flag any claim that is not backed by a fact id.
- Fix everything. `npm run check:facts` passes. Facts used in game have `status: checked`.
- Make sure each diorama shows "Model, not to scale", every real image shows its exact credit, and the About page has a Sources section linking every NASA page used.

## 4. Licensing and safety audit

- `CREDITS.md` and the in-game Credits list every asset, font, library and dataset with its license and source.
- Search the repo to confirm nothing came from the Messenger reference bundle or any Abeto asset.
- Confirm no NASA insignia, logotype or seal appears anywhere (including the favicon and social image).
- Confirm no analytics, trackers, free text sharing or third-party embeds.

## 5. Bug bash

- Run every Playwright test. Zero console errors and zero unhandled promise rejections across a full playthrough.
- Test edge cases: refresh mid-chapter, leave and rejoin co-op, switching tabs during audio, very small and very wide screens, slow network, WebGL unavailable (Field Guide path).
- Fix, then rerun.

## 6. Final visual polish

- Re-capture the full screenshot set at 1440x900 and 390x844 into `docs/screens/final/`.
- Review against Game Bible section 9 and the taste skill rules. Polish the details that make it feel premium: line boil timing, paper springs, stamp impact, lamp glow, outline weights, color grading per world, title letter bounce, Milo's small habits.
- Make a social share image (1200x630) and favicon in the Game Bible style (no NASA logos).

## 7. Final deploy

- Deploy, tag a release (`v1.0.0`), and smoke-test the live URL from a desktop browser and a phone-sized viewport. Test a two-player co-op session in production.
- Put the final URL at the top of README and PROGRESS.md.

## 8. Submission kit (write into `docs/submission/`)

1. **README.md (repo root):** what it is, live URL, how to play (controls, co-op), how it answers the challenge, NASA data and resources used (with links), how accuracy is handled, tech stack and hosting, credits, license, and an **AI use disclosure** (which AI tools were used and for what; check the 2026 Space Apps terms for any required wording and follow it).
2. **About page in the game:** short story summary, Sources, Credits, the *For grown-ups* note, team names (placeholder list the humans fill in).
3. **30-second video:** follow the storyboard in Game Bible section 17. Capture real gameplay with Playwright video recording or `canvas.captureStream`, add the game's own music and on-screen captions, and assemble with `ffmpeg` into a 1920x1080 MP4 of at most 30 seconds. Save as `docs/submission/demo-30s.mp4` and keep the capture script so it can be re-made after fixes. The humans upload it to a public host.
4. **7-slide outline** (`docs/submission/slides.md`): 1 Title and one-line pitch; 2 The challenge and who it serves; 3 The idea (dioramas, letters, Milo); 4 How it teaches (one example per world); 5 NASA data and accuracy (sources, live Voyager data, myth corrections); 6 How it's built (stack, Cloudflare, kid-safe co-op, accessibility, Field Guide); 7 What's next and the team. Include the screenshots to use on each slide.
5. **Project page text** (`docs/submission/project-page.md`): title, high-level summary (about 150 words), detailed description, how NASA data was used, space agency partner data if any, tools and languages, AI disclosure, links (demo URL, repo, video).
6. **Judge path** (`docs/submission/judge-path.md`): a 3-minute route through the game, plus how to turn on *Explore freely* to jump straight to Mars or the Finale.

## Definition of done

- [ ] Budgets met; accessibility, accuracy, licensing and safety audits passed
- [ ] Zero console errors; all tests green
- [ ] Final deploy tagged; live URL verified on desktop, phone viewport and in co-op
- [ ] Submission kit complete in `docs/submission/`
- [ ] PROGRESS.md shows everything checked, with a short list of known issues and ideas for after the hackathon
