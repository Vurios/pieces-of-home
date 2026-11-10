# Phase 03: Loading screen, title sequence and the notebook UI

**Goal:** the first 20 seconds make a judge lean in. Then every 2D surface feels like Dad's notebook: warm, handmade, readable and accessible. No AI-slop UI anywhere.

Read `CLAUDE.md` and Game Bible sections 10, 11 and 13. Use the **taste skill** (`design-taste-frontend`) and **frontend-design** skill for every DOM surface in this phase, filtered through our art direction.

---

## 1. What the Messenger loader does, and what we do better

Messenger shows a white page with a small hand-drawn envelope whose outline "boils": eight copies of the same SVG path, each slightly different, shown one after another on a 1-second CSS loop (each frame visible for 1/8 of the cycle). Then a teal title screen where chunky block letters sit over the planet with a BEGIN button. It is charming but generic in progress feedback and says nothing about the game.

Ours tells the story while it loads, reflects real progress, and turns the required "click to start audio" into the first emotional beat.

## 2. The loader (inline in `index.html`, works before any JS)

- **Instant paper:** warm paper color, faint engineering grid, a soft coffee-ring stain, subtle paper grain from an inline SVG noise filter. Total inline weight under about 25 KB.
- **The lamp draws itself:** an ink sketch of Dad's desk lamp as SVG paths. Real loading progress drives each stroke (stroke-dashoffset), in drawing order: base, arm, joint, shade, bulb. Add a 3-frame line boil (three slightly different versions of each path, swapped at about 8 to 12 fps) so it never looks frozen.
- **"Things that kept working":** in a handwriting font, a short list writes itself down the margin, one line per loading milestone (hub geometry, textures, audio engine, UI). Lines come from `facts.json` kid wording, kept tiny: "100 little mirrors at Tranquility Base." "Voyager 1, still sending." "Ingenuity, saving notes." Last line: "This lamp."
- **Progress source:** a weighted progress aggregator over the Three.js LoadingManager, font loading, audio worklet or setup, and any JSON. Never fake progress.
- **Ready:** the bulb flicks on (a warm radial bloom across the page), a quiet hum starts once audio is allowed, and the line *"For all the questions we haven't answered yet."* writes itself. Then the prompt **Turn on the light** (click, tap or any key).
- **That gesture** resumes the AudioContext, plays the lamp click, and hands off to the 3D scene.
- **Edge cases:** after 8 seconds, show *"Still loading. The lamp is warming up."* plus a percentage. If WebGL is unavailable, show a kind paper note and a big link to the Field Guide. `prefers-reduced-motion`: no boil, no page curl, a quick cross-dissolve. Progress is exposed through an `aria-live` region and a real `progress` element for screen readers.

## 3. Title sequence (3D)

- **Transition:** the paper curls away (CSS 3D or a canvas page curl), revealing the 3D scene framed on the lamp's glow inside the workshop. The camera pulls back out through the window and up to the whole Home planet at dusk.
- **Block-letter title:** "PIECES / OF / HOME" in three stacked lines made from chunky beveled 3D block letters designed in code (an original block alphabet on a small grid, not a font file). Letters drop onto the planet one by one with a soft bounce, each playing one note of the six-note motif (Phase 04 provides the notes; use placeholder tones until then).
- **The O in HOME is a glass bulb** that warms up after the last letter lands.
- **BEGIN:** a pull-chain switch hanging below the title. Pull (click, tap, Enter or gamepad A): the bulb brightens, windows on the planet light up, music starts, the menu opens.
- **Menu as notebook tabs** sliding in from the side: Continue (if a save exists), New story, Play together, Field Guide, Settings, Credits. Chapter select appears after the prologue is finished, or always when *Explore freely* is on.

## 4. HUD

- Small ink-stamp buttons at the screen edge: Notebook, Photo, Emote, Settings (and Hint as a small pencil mark). Large touch targets on mobile.
- The paper arrow to the next letter (from Phase 02).
- Interaction prompt: hand-drawn key cap on desktop, tap icon on touch, the right button glyph on gamepad.
- **Speech bubbles:** paper bubbles above speakers with a handwritten speaker name, typed-on text, and Messenger-style gibberish voice blips (hook for Phase 04). Subtitles mirror into a bottom caption bar when bubbles are off-screen.
- **Stamp moment:** when a chapter completes, a big ink stamp thunks onto the screen: LEFT BEHIND. STILL ANSWERING. Brief, satisfying, skippable.
- **Toasts:** small paper notes for "Saved", "Photo kept", "Nori joined".

## 5. The notebook

- A two-page spread over a slightly blurred, darkened world (the world audio muffles while it is open).
- Each machine gets a spread: Dad's drawing, *What it was for*, *What we learned*, a taped polaroid of a real NASA image with a museum-label credit and source link, *Then and Now* status, Dad's note in handwriting, and a fold-out *Deeper notes* for older readers. Every number comes from `facts.json`.
- Pages fill in progressively as letters are delivered (pencil sketch first, inked when complete).
- Memories collected appear as small envelopes that replay the memory.
- Navigation: page turns with drag, arrows, keyboard and gamepad. Proper headings and reading order for screen readers.
- Hand-drawn shapes (underlines, circles, arrows, boxes) generated with `roughjs`, pen strokes with `perfect-freehand`, or hand-authored SVG. Keep them crisp at all sizes.

## 6. Settings

Audio buses (master, music, ambience, effects, voices), subtitles (on by default), text size, reading font option (dyslexia-friendly), high-contrast UI, reduced motion, controls remap, quality tier (Auto, Low, Medium, High), language (English now; Filipino stub ready), *Explore freely* (unlocks every chapter), read-aloud for notebook pages (browser speech synthesis).

## 7. Field Guide mode

- A separate lightweight route (for example `/field-guide`) that renders the full story and every machine's notebook spread as plain, semantic HTML from the same content and facts data. No WebGL.
- Readable with a screen reader, keyboard friendly, fast on old devices, and printable (a clean print stylesheet with sources and credits) so teachers can hand it out.
- Linked from the title menu, the loader fallback and the About page.

## 8. Type and visual system

- Self-host open-license fonts (for example via `@fontsource`): a warm handwriting face for Dad, a highly legible sans for reading text (Atkinson Hyperlegible Next or similar), and a stencil or slab face for stamps and museum labels. Let the taste skill confirm or improve the picks, but never fall back to Inter, Roboto, Poppins or system defaults for display text.
- Colors from the Game Bible palettes. Paper, ink and lamp amber dominate. Never purple-blue gradients, glassmorphism or generic sci-fi HUD styling.
- Motion: springy paper with small overshoot, 2 to 3 frame line boil on drawn elements, page turns of 400 to 600 ms. No generic fade-ins.
- Copy: no em dashes, short sentences, grade 3 to 5 reading level.

## 9. Verify

- Playwright screenshots of: loader at 0, 50 and 100 percent; the "Turn on the light" moment; title mid-assembly and complete; menu; HUD in play; notebook spread; settings; Field Guide. At 1440x900 and 390x844. Save in `docs/screens/phase03/`.
- Run the taste skill's checker on DOM pages if it is available. Run `axe-core` on the menu, notebook, settings and Field Guide; fix every serious issue.
- Keyboard-only and gamepad-only passes through loader, title, menu and notebook.
- Measure: time to first paint of the loader, time until "Turn on the light" on a throttled connection.

## Definition of done

- [ ] Loader paints instantly, draws the lamp from real progress, and handles slow, no-WebGL and reduced-motion cases
- [ ] "Turn on the light" unlocks audio and flows into the 3D title without a hitch
- [ ] Block-letter title with the bulb O and the pull-chain BEGIN
- [ ] HUD, speech bubbles, stamps, toasts, notebook, settings and Field Guide done
- [ ] Screenshot review and accessibility checks passed
- [ ] Commit, deploy, update PROGRESS.md, then continue to Phase 04
