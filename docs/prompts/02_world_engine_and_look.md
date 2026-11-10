# Phase 02: Tiny-planet engine and the look

**Goal:** walk around a beautiful Home planet at dusk with a chunky chibi character, a smooth camera, ink outlines and lamp-lit color, at 60 fps on a mid laptop. This phase decides whether the game looks premium or generic, so iterate on screenshots until it is right.

Read `CLAUDE.md` and the Game Bible sections 7, 9, 13, 15 and 16 first.

---

## 1. Study the reference, then write our own

Clone `https://github.com/arafays/messenger-copy` into a scratch folder outside the repo (for example `../_reference/`). Study, do not copy:

- How it structures scenes (intro, gameplay, NPC gallery) and loads compressed geometry and textures (Draco, KTX2, batched meshes).
- The post-processing idea in `src/lib/messenger/postProcessing.ts` and `postMaterial.ts`: depth-based ink outlines plus color grading through a lookup table.
- The original game's bundle shows more: outlines from depth and normals with fade by distance, a 3D LUT, MSDF text, web workers for geometry and collision, a low-memory device tier, and handling of `visibilitychange`.

Then write original implementations. Never copy files, shaders, textures, models, fonts or audio from the `reference/` folder or any Abeto asset (see `CLAUDE.md`).

## 2. Engine systems

- **Planet:** radius, procedural terrain (displaced icosphere with crater stamps and gentle noise), surface placement by latitude and longitude, gravity toward the center. Home is a bit larger than chapter worlds for comfort.
- **Character controller on a sphere:** up vector from the planet center, movement in the tangent plane, smooth turning, walk, run, jump with soft landing, step-up on small bumps. Collision against terrain and props (use `three-mesh-bvh` for raycasts or a simple capsule-vs-collider system; your call).
- **Follow camera:** third person, slightly above and behind, with lag and gentle look-ahead. Keep the horizon stable and auto-recenter behind the player after a short delay. Prevent clipping into props. This fixes the disorientation some players reported in Messenger.
- **Objective arrow:** a small hand-drawn paper arrow near the character pointing along the surface to the next letter.
- **Interaction system:** proximity prompts with a hand-drawn key cap or tap icon; carry and deliver an envelope; hold-to-steady for puzzle pieces.
- **Input:** keyboard (WASD and arrows), mouse, touch (virtual joystick plus action buttons, portrait and landscape), gamepad (Gamepad API). Remappable keys stored locally.
- **World manager:** load and unload worlds lazily (each world is its own chunk of code and assets), transitions with the Looking Lamp effect (an iris of warm light), keep the Home world cached.
- **Event bus and game state store:** a small typed event bus (the Messenger code uses one) and a serializable state object for save and co-op sync.
- **Quality tiers:** detect device capability (for example with `detect-gpu`, device memory and pixel ratio) into Low, Medium, High. Tiers control pixel ratio, outline quality, tilt-shift blur, shadows, particle counts and audio layers. Allow manual override in Settings.
- **Debug overlay (dev only):** fps, draw calls, triangles, memory, current tier.

## 3. Rendering and art (Game Bible section 9)

- **Toon material:** 2 to 3 light bands, warm rim light, colors from a small palette per world. Optional subtle noise breakup so surfaces feel painted, not plastic.
- **Post-processing:** ink outlines from depth and normal edges in dark warm grey (never pure black), fading with distance; per-world color grading via a generated 3D LUT; light paper grain; vignette; tilt-shift blur at the top and bottom edges on Medium and High tiers to sell "miniature".
- **Lighting:** Home at dusk, with the workshop lamp as a warm point light that matters. Moon with hard light, black sky and Earth low on the horizon. Mars with butterscotch sky and soft light.
- **Sky:** gradient sky dome per world, stars where it makes sense, drifting soft cloud or dust noise on Home and Mars.
- **Particles:** dust motes in the lamp light, small regolith puffs at footsteps, Mars dust.
- **The diorama feel:** each chapter world sits under a faint glass-dome reflection when seen from outside; inside, small "model kit" details like Dad's tags on stakes.

## 4. Home world (first pass)

Build the Home planet: house and porch, garden, mailbox, Dad's workshop shed with a dollhouse cutaway when the player steps inside, a hill with a telescope, a backyard dish antenna, and the workbench with the glass domes, Milo on his stand, the notebook and two globes.

- **Globes:** real NASA public-domain Moon and Mars maps (for example the NASA SVS CGI Moon Kit and a USGS Mars mosaic) at modest resolution, with pins at the real landing coordinates from the facts file (store coordinates in `facts.json` with sources).
- Workshop clutter in Dad's style: sketches pinned to the wall, a coffee mug, a jar of screws, a small solar lamp. It should feel lived-in and warm.

## 5. Characters and Milo

- Decide the character approach by prototyping quickly and comparing screenshots: (a) original procedural chibi characters built in code (simple rigs, procedural walk with bob and limb swing), or (b) CC0 rigged packs (KayKit, Kenney, Polygonal Mind 100 Avatars) restyled with our toon material and recolored. Prefer whichever looks more cohesive and charming. Avoid packs with no-redistribution licenses because the repo is public. Log the choice.
- Four playable kids with distinct silhouettes and colors from Game Bible 5.5: Remi (backpack, mustard jacket), Nori (cap, orange-red windbreaker), Lumi (beret, lavender hoodie, sketchbook), Theo (goggles, teal overalls, tool belt).
- Animations: idle (with personality variant), walk, run, jump, land, interact, carry, emote, celebrate.
- **Milo stages 0 to 5** as one modular model whose parts can be shown or hidden: lamp head (dark, then glowing), corner-cube eyes, mesh wheels, solar heart, rotor, golden-record chest. Milo follows with a gentle spring and has simple expressive animations.

## 6. NASA hardware models (pipeline for later phases)

- Write `scripts/assets/` tooling: download GLB models from NASA 3D Resources, inspect triangle counts and materials, simplify (for example `@gltf-transform/cli` with meshopt simplify and compression), and swap materials for our toon material.
- If a NASA model is too heavy or does not match the style, rebuild a low-poly version in code or by hand from NASA photos. Silhouettes must stay faithful.
- Record every model's source and credit in `CREDITS.md` and `credits.json`.

## 7. Visual review loop (mandatory)

- Write a Playwright script that opens fixed camera bookmarks (Home wide shot at dusk, porch, inside the workshop, the workbench close-up, a character close-up) and saves screenshots at 1440x900 and 390x844 into `docs/screens/phase02/`.
- Look at every screenshot yourself. Compare against the Game Bible palette and mood. Fix anything that reads as generic, flat, plastic, too dark, too busy or off-palette. Do at least two full passes.
- Optional: spawn a subagent to review the screenshots cold against Game Bible section 9 and list the top five problems.

## Definition of done

- [ ] Walk, run and jump around the Home planet with keyboard, touch and gamepad
- [ ] Camera feels calm, never disorienting; objective arrow works
- [ ] Toon shading, ink outlines, grading, grain, vignette and tilt-shift working, with quality tiers
- [ ] Home world dressed and lamp-lit; globes with real maps and pins
- [ ] Four characters and Milo stage 0 in place; character approach logged
- [ ] Two screenshot review passes done and saved
- [ ] 60 fps on a mid laptop at High; Low tier runs on a phone
- [ ] Commit, deploy, update PROGRESS.md, then continue to Phase 03
