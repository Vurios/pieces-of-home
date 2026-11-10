# Phase 05: The story, the worlds and the puzzles

**Goal:** the whole story is playable from the prologue to the credits, every fact is verified and sourced, and each world teaches one engineering idea through play. Build P0 first and polish it, then P1, then P2. There is no time limit: every world, including the bonus chapter, gets built.

Read `CLAUDE.md`, all of `docs/GAME_BIBLE.md` (especially sections 5, 6 and 7) and `docs/FACT_SHEET.md`.

**Build order:** content system, Prologue, Chapter 1 (Moon, Apollo 11), Chapter 3 (Mars, Opportunity), Finale, then Chapter 2 (Apollo 15 rover), Chapter 4 (Ingenuity), then the P2 items (Archive cards, the Surveyor 3 bonus chapter, Filipino story text). After each world: screenshot review, a playthrough test, commit, deploy.

---

## 1. Verify facts first (use a subagent)

Before writing chapter copy, spawn a subagent to work through every `verify` row in `docs/FACT_SHEET.md` that the P0 and P1 chapters use. For each one: find a primary NASA, JPL, NSSDCA, LROC, Smithsonian or Apollo Lunar Surface Journal page, confirm the exact value and wording, and update `src/data/facts.json` (`status: checked`, `sourceUrl`, `checkedOn`). If a fact cannot be confirmed, mark it `unverified` and change the design so the game does not depend on it (log in DECISIONS.md). Also find the NASA/JPL primary page for the Voyager 1 light-day milestone and for the Golden Record.

`npm run check:facts` must pass before a world counts as done.

## 2. Content system

- Chapters are typed data in `src/content/chapters/*.ts`: world id, dome label, arrival text, Dad's tag text, three letters (recipient object id, letter text, story beat script, fact ids), main activity id, Milo upgrade id, memory script, notebook spread id, stamp text.
- Dialogue scripts are small arrays of lines (speaker, text key, optional voice line id, optional camera bookmark). All strings live in `src/data/strings.en.json` so translation is possible.
- Notebook spreads are data too: drawing asset, sections, fact ids, images (with credit and source), Then and Now, Deeper notes, Dad's note.
- Puzzles are modules in `src/game/puzzles/` with a shared interface: setup, solo mode, co-op mode (roles and holders), progress events, completion, hint tiers, and a debug "solve" for automated tests.
- Simple cinematic beats: camera rails between bookmarks, letterbox optional, skippable, subtitles always.
- Save system: autosave after each delivery, upgrade and stamp (local storage or IndexedDB). Continue from the title.

## 3. Real images and data

- `scripts/fetch-nasa-images.ts`: query the NASA Image and Video Library API (`https://images-api.nasa.gov`, no key needed) and other sources listed in the fact sheet (JPL Photojournal, LROC) for each notebook slot. Save resized WebP files into `public/images/notebook/`, with NASA ID, title, exact credit line and source URL in `src/data/credits.json`. Pick images a kid can read at a glance.
- `scripts/fetch-horizons.ts`: call the JPL Horizons API for Voyager 1 (target `-31`) as seen from Earth, with daily steps from 2026-11-01 to 2028-12-31, saving date, distance (km and AU), one-way light time, and RA and Dec into `src/data/voyager1.json`. The game interpolates for today's date and falls back to the nearest row outside the range. Cross-check the November 18, 2026 value against the light-day fact.
- Globe pins use coordinates from `facts.json` (with sources).

## 4. Worlds and activities

Follow Game Bible section 6 for every world. The notes below add build guidance.

### Prologue: The Workshop (P0)

- Mom on the porch, the key, the self-switching lamp, the notebook, Milo stage 0, the first letter "To the lamp", the stamp LEFT ON. STILL SHINING., the globes lighting up, the Looking Lamp transition into the first dome.
- Teach: move, interact, carry, deliver, notebook, photo, emote. Use the friends in the workshop for solo hints.

### Chapter 1: Tranquility Base (P0)

- Layout from Apollo 11 site maps (Apollo Lunar Surface Journal, LROC), compressed onto the small sphere but keeping the relative arrangement: descent stage, flag, reflector, seismometer, footprints. Earth fixed low in the sky.
- **Send a Light, Get a Light:** a dotted laser beam arrives from Earth. Flat mirror first (the beam misses Earth). Then three mirror panels snap into an inside-corner frame and the beam returns from any angle; rotating the frame proves it. Fire a pulse: "ping", then the return "pong" after the real round-trip delay from `facts.json`. Finish with all 100 cubes glinting back at Earth.
- Beam physics: real reflection math for the flat mirror and the corner (reflect across each panel's normal); visualize with a dotted line that animates along its path.
- Solo: holders keep panels in place. Co-op: one player per panel holds it steady, another fires from the Earth console.
- Milo stage 1 (corner-cube eyes), the flashlight memory, notebook spread, stamp.

### Chapter 3: Meridiani Planum (P0)

- Butterscotch sky, ochre ground, dust devils wandering on the horizon. A blue-tinted sunset near the Sun only if verified.
- **Blueberries:** rock grinder mini-activity, Milo-eye microscope view, three clue cards sorted into "formed in water" or "not".
- **Wait for the Wind:** dusty panels, a low power meter, "No hands on Mars" when players try to wipe them. Breeze flags nudge a dust devil's path (simple steering field). When it crosses the panels, dust clears, power rises, the model rover chirps awake. Solo: up to 3 flags, a new dust devil every 20 seconds, nothing fails. Co-op: each player holds a flag and the combined push steers.
- **The Long Storm:** sky darkens over about a minute; the last data appear as numbers on a small screen (low power, dark sky); the notebook explains that people put words to the rover's data (only if `opp-quote-myth` is verified; otherwise skip the quote entirely); players send calls one tap at a time and the counter passes 1,000; no answer; Dad's margin note.
- Milo stage 3 (solar heart), the "90-day warranty" memory, notebook spread, stamp.

### Finale: The Long Light (P0)

- Night on Home. The backyard dish. A simple star map overlay; Voyager 1's real direction from `voyager1.json` (RA and Dec) placed in the game sky. Players aim the dish (drag or stick) and send Dad's last letter. The notebook shows: "At the speed of light, this would take about X hours Y minutes to reach Voyager 1" from today's interpolated light time.
- Date-aware milestone text (before and after November 18, 2026).
- Milo's record clicks in. Milo plays Dad's saved messages (captions always). Then the players' photos.
- The last page: group photo, favorite-discovery sticker, next-adventure name (word chips; free text only in solo, never sent to others).
- Ending scene, credits with every source and asset credit, then museum free roam.

### Chapter 2: Hadley-Apennine (P1)

- Wheel lab (three wheels on a dusty strip; claims worded only as verified), then the rideable model rover. Rear-steer-only driving if verified, otherwise a "challenge mode" with no historical claim. Navigate by a taped LROC traverse image to the rille overlook, then park the rover back in its spot.
- Co-op: driver and navigator seats; others walk ahead and plant sample flags. Solo: Milo navigates.
- Milo stage 2 (mesh wheels), bike memory, notebook, stamp.

### Chapter 4: Valinor Hills (P1)

- Rotor bench with blade length, spin speed and an Earth air / Mars air switch; a simple lift model where lift grows with air density and blade speed, numbers rounded and labeled "model". In Mars air the model barely lifts until the blades are bigger and faster.
- Scout flight with Milo's rotor camera to mark a safe path; others (or the solo player afterward) drive the model rover along it.
- Leave a note for later with word chips; it reappears in the museum.
- The Wright Flyer fabric detail, then the scrap of Remi's drawing inside Milo.
- Milo stage 4 (rotor), paper-plane memory, notebook, stamp.

### P2 (built last)

- **Archive cards** for Sojourner, Viking 1, Spirit, InSight and the Apollo 14 and 15 reflectors, each only with verified facts.
- **Bonus chapter: Ocean of Storms (Surveyor 3 and Apollo 12).** Follow Game Bible section 6. Players guide a pinpoint landing near the probe using crater landmarks, then help snip its camera and scoop to bring home for study. Include the *Science checks itself* note about the microbe claim (only as verified). Milo gains a small scoop arm (picks things up, hands them to players). Stamp: LEFT BEHIND. STILL TEACHING US HOW THINGS AGE. Verify every fact first (`sur3-*` rows, plus the Surveyor 3 landing date).
- **Filipino translation** of all story and notebook text, reviewed by the team.
- **Real recorded voice lines** for Dad if a teammate records them.

## 5. Writing

- Write every line of final copy: arrival lines, letters, story beats, memories, notebook text, Deeper notes, Then and Now, hints (three tiers per puzzle), stamps, toasts, About page, *For grown-ups* note, credits.
- Follow Dad's voice guide (Game Bible 5.7) and the grief care rules (5.9). Kids talk like kids, briefly.
- Reading level around grade 3 to 5 for main text. No em dashes. Every number from `facts.json`.
- Spawn a subagent to review all copy cold for clarity, reading level, tone, and any claim not backed by a fact id.

## 6. Systems to finish here

- Photo mode (polaroid frame, saved locally, about 24 max) and its use in the ending.
- Emote wheel and preset phrases (also used by co-op).
- Hint system (three tiers; friends in the workshop for solo).
- Chapter select and *Explore freely*.
- The workshop changes after each chapter (photo on the wall, Milo stage, glowing dome, museum shelf).

## 7. Automated playthroughs

- Add debug hooks (dev builds only) to teleport, deliver, and solve puzzles.
- Playwright tests that run each world's critical path from arrival to stamp, and one test that goes from the title to the credits using the hooks. Capture screenshots at key beats into `docs/screens/phase05/`.
- A human-style pass with no hooks for Chapter 1 to make sure the puzzle can be understood without reading instructions.

## Definition of done

- [ ] All P0 worlds playable start to finish, solo, with no fail states
- [ ] Every fact used is verified, sourced and passes `npm run check:facts`
- [ ] Notebook spreads complete with real images and credits
- [ ] Finale uses live Voyager data with date-aware text
- [ ] P1 worlds done
- [ ] P2 items done: Archive cards, Surveyor 3 bonus chapter, Filipino text
- [ ] Copy reviewed; screenshots reviewed; playthrough tests green
- [ ] Commit, deploy, update PROGRESS.md
