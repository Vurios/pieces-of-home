# Phase 04: Music, sound effects and voices, all in JavaScript

**Goal:** a warm, living soundscape generated at runtime with the Web Audio API. No copyrighted recordings. It should feel handmade, like the rest of the game, and react to what players do.

Read `CLAUDE.md` and Game Bible section 12. This phase can run in parallel with Phase 05 or 06 in a separate session or worktree once Phase 02 is merged.

---

## 1. What Messenger does (study, then improve)

The original game's bundle shows a central audio controller built on Three.js `Audio` and `PositionalAudio` (Web Audio under the hood, HRTF panning for positional sounds) and an event bus (`play_audio`, `stop_audio`, `play_positional`). Cues are registered by name with `volume`, `loop`, `autoPlay`, `minTimeBetweenPlays` (anti-spam) and `sync` options. Notable tricks:

- All zone ambiences (forest, city, beach and so on) start looping at volume 0, and the player's location crossfades their volumes.
- Footsteps are one long synced loop whose volume rises while walking, instead of one-shots per step.
- Gibberish dialogue voices (male and female sets) and bubble start and end sounds.
- Title "rune" notes as letters appear.
- A low-memory device path with a lighter music file and fewer effects.
- Audio pauses with `visibilitychange`.

We keep that architecture and synthesize everything ourselves.

## 2. Audio Director

- One `AudioContext`, created suspended and resumed on the "Turn on the light" gesture.
- Buses: master (with a gentle compressor and a limiter), music, ambience, effects, voice, UI. Volume per bus from Settings, saved locally.
- Cue registry by name with options: volume, loop, pitch and volume randomness, `minTimeBetweenPlays`, max voices, bus, positional or not.
- Positional emitters using `PannerNode` (HRTF on High tier, equal-power on Low) attached to world objects: the lamp hum, Milo, the model rovers, dust devils, the dish servo.
- Zone ambience layers crossfaded by position (workshop interior vs garden on Home; per world elsewhere).
- Footsteps: either the synced-loop approach or per-step synthesis triggered by the animation's foot contacts. Choose by how it sounds; surfaces are wood, grass, regolith, Mars dust.
- **Ducking:** voices duck music by a few dB. **Notebook open:** a low-pass filter slowly closes on the world buses so the world sounds muffled behind the page.
- Suspend on tab hide, resume on show. Low tier: fewer layers, no convolution reverb, mono emitters.
- An `audio-lab` dev page that lists every cue with a play button and the music state switches, so humans can review everything quickly.

## 3. Music: generative, adaptive, original

Use Tone.js or raw Web Audio; your call (log it).

- **Instruments (synthesized):** a music box (FM bell with soft decay), a felt-piano-like tone (filtered triangle plus a short noise thump), a warm pad (detuned saws through a low-pass), a soft sub bass, and light vinyl crackle (filtered noise with random clicks). Optional brushed percussion made from noise.
- **The motif:** six notes, simple and singable, first heard as the title letters land, then woven through everything. Write it down in `src/audio/motif.ts` with a comment describing its shape.
- **Per world arrangement:**
  - Home: warm major sevenths, slow, cozy.
  - Moon: sparse glassy bells, long gaps, lots of air, no bass.
  - Mars: low warm pads, pentatonic phrases, filtered dust noise.
  - Finale: the full theme, building gently to a final statement when Milo speaks.
- **Adaptive layers:** explore (base), focus (puzzles thin the texture and add a pulse), discovery sting (quantized to the next beat or bar), and **one extra instrument for each co-op friend present** (bells, then plucks, then a counter-melody). Leaving players fade their layer out.
- **The Long Storm** (Chapter 3): music thins to a single held tone and crackle, then silence for the unanswered calls, then the motif returns softly on Dad's margin note.
- Tempo and harmony changes happen on bar lines. No clicks or pops when switching.

## 4. Sound effects recipes (synthesized; ZzFX allowed)

Make each one deliberately, tune by ear, and keep a short comment on how it is built:

- Lamp click and hum, page flips, pencil scribble, tape, ink stamp thunk, paper toast
- Footsteps per surface, jump, land, small regolith puff
- Envelope pick-up and delivery chime
- Milo: boot-up, happy, curious, sleepy (solar nap), hop, part clicking into place (a satisfying mechanical clunk plus chime)
- Laser ping and its return pong, with the real round-trip delay of about 2.5 seconds from `facts.json` (Chapter 1)
- Mirror panel snap, corner-cube "click home" sparkle
- Mesh-wheel crunch, rover electric motor whine, steering servo (Chapter 2)
- Rock grinder buzz, microscope focus, dust devil whoosh (positional), solar power-up rising tone, the call-signal blip (Chapter 3)
- Rotor whir that rises with spin speed, hover hop (Chapter 4)
- Dish servo, radio hiss, record crackle and needle drop (Finale)
- Camera shutter and polaroid whirr, emote pops, co-op join and leave chimes

## 5. Voices

- **Gibberish babble** per character, Messenger style: short syllables from a formant-filtered oscillator (two or three band-pass filters approximating vowels) with a pitch contour that follows punctuation (questions rise). Per-character pitch, speed and timbre: Remi mid and steady, Nori higher and bouncy, Lumi soft and breathy, Theo lower and cheerful. Milo uses bleeps, never words.
- **Dad's recordings:** if `public/audio/vo/<lineId>.ogg` exists (a teammate may record real lines), play it; otherwise play a warm low hum-babble under handwritten captions. Captions always show.
- Subtitles stay on by default and use the speaker name.

## 6. Mix and verify

- Target a calm overall loudness; nothing should spike. Test on laptop speakers and on phone speakers.
- Check that audio starts only after the user gesture, survives tab switching, and that the notebook muffle and voice ducking feel smooth.
- Record a 60-second capture of the Home world and the title sequence and listen for clicks, harshness and repetition.
- Verify CPU cost on Low tier; keep audio work small enough to hold frame rate.

## Definition of done

- [ ] Audio Director with buses, cues, positional emitters, zone ambience, ducking and notebook muffle
- [ ] Generative music with the motif, per-world arrangements and adaptive layers, including one layer per co-op friend
- [ ] Every effect in the list exists and sounds intentional
- [ ] Gibberish voices per character, Dad's line fallback, subtitles
- [ ] `audio-lab` page for human review
- [ ] Commit, deploy, update PROGRESS.md
