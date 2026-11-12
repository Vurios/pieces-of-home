# Credits

Every asset and library in Pieces of Home is listed here and in `src/data/credits.json`, with its source and license.

NASA is credited as a source of images, models and data. NASA does not sponsor or endorse this project. The NASA insignia, logotype and seal are not used.

## Images, models and textures

| Asset | Credit | License | Source |
|---|---|---|---|
| Moon globe map (`textures/globes/moon.jpg`), CGI Moon Kit color map, unchanged | NASA's Scientific Visualization Studio | Public domain | https://svs.gsfc.nasa.gov/4720 |
| Mars globe map (`textures/globes/mars.jpg`), Viking MDIM 2.1 colorized global mosaic, downscaled to 1024 by 512 | NASA Ames / USGS Astrogeology Science Center | Public domain | https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m |
| Notebook photo `images/nasa/apollo11-lrrr.jpg`: Astronaut Edwin Aldrin after deployment of EASEP on surface of moon (AS11-40-5948), resized | NASA | Public domain (NASA media) | https://images.nasa.gov/details/as11-40-5948 |
| Notebook photo `images/nasa/apollo11-lroc.jpg`: A Stark Beauty All Its Own (LROC M175124932R), resized | NASA/GSFC/Arizona State University | Public domain (NASA media) | https://www.lroc.asu.edu/images/484 |
| Notebook photo `images/nasa/apollo15-lrv.jpg`: Astronaut David Scott on slope of Hadley Delta during Apollo 15 EVA (AS15-85-11451), resized | NASA | Public domain (NASA media) | https://images.nasa.gov/details/as15-85-11451 |
| Notebook photo `images/nasa/opportunity-tracks.jpg`: Looking Back on a Golden Opportunity (PIA22928), resized | NASA/JPL-Caltech | Public domain (NASA media) | https://science.nasa.gov/photojournal/looking-back-on-a-golden-opportunity/ |
| Notebook photo `images/nasa/opportunity-blueberries.jpg`: "Berries" on the Ground (PIA05273), resized | NASA/JPL/Cornell/USGS | Public domain (NASA media) | https://science.nasa.gov/photojournal/berries-on-the-ground/ |
| Notebook photo `images/nasa/ingenuity-shadow.jpg`: Ingenuity's First Black-and-White Image From the Air (PIA24584), resized | NASA/JPL-Caltech | Public domain (NASA media) | https://science.nasa.gov/photojournal/ingenuitys-first-black-and-white-image-from-the-air/ |
| Notebook photo `images/nasa/ingenuity-valinor.jpg`: Ingenuity at 'Valinor Hills' (PIA26237, detail), resized | NASA/JPL-Caltech/ASU/MSSS | Public domain (NASA media) | https://science.nasa.gov/photojournal/ingenuity-at-valinor-hills/ |
| Notebook photo `images/nasa/voyager.jpg`: Mementos of Earth (PIA17035), resized | NASA/JPL-Caltech | Public domain (NASA media) | https://science.nasa.gov/photojournal/mementos-of-earth/ |

No NASA 3D model ships yet. The pipeline in `scripts/assets/` prints the credit line for each model when one is added.

## Fonts

All fonts are self-hosted from `public/fonts/`, Latin subset only, with their license files beside them.

| Font | Use | License | By | Source |
|---|---|---|---|---|
| Kalam | Dad's handwriting | SIL Open Font License 1.1 | Indian Type Foundry | https://github.com/itfoundry/kalam |
| Fraunces | Titles and headings | SIL Open Font License 1.1 | Undercase Type (Phaedra Charles, Flavia Zimbardi) | https://github.com/undercasetype/Fraunces |
| Atkinson Hyperlegible Next | Reading text | SIL Open Font License 1.1 | Braille Institute of America | https://www.brailleinstitute.org/freefont/ |
| Zilla Slab | Museum labels, tags and stamps | SIL Open Font License 1.1 | Mozilla, Typotheque | https://github.com/mozilla/zilla-slab |
| OpenDyslexic | Optional reading font | SIL Open Font License 1.1 | Abbie Gonzalez | https://opendyslexic.org |

## Audio

Most music and sound is still made in code at runtime with the Web Audio API. The recorded files below live in `public/audio/` and are listed one by one in `src/data/credits.json`. Kenney and VCSL files were trimmed, faded, normalized and re-encoded as mono MP3; VCSL notes were checked by pitch analysis and fine-tuned to A440 where needed. The NASA clips were only trimmed, faded and level-matched, and the Mars wind was made into a seamless loop.

| Files (under `public/audio/`) | What | Credit | License | Source |
|---|---|---|---|---|
| `sfx/step-grass-{1,2,3,4}.mp3` | Footstep on grass, from footstep_grass_000.ogg, footstep_grass_001.ogg, footstep_grass_003.ogg, footstep_grass_004.ogg | Kenney, Impact Sounds | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `sfx/step-wood-{1,2,3,4}.mp3` | Footstep on wood, from footstep_wood_000.ogg, footstep_wood_001.ogg, footstep_wood_002.ogg, footstep_wood_004.ogg | Kenney, Impact Sounds | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `sfx/step-gravel-{1,2,3,4}.mp3` | Footstep, from footstep04.ogg, footstep05.ogg, footstep06.ogg, footstep09.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/step-snow-{1,2,3,4}.mp3` | Footstep in snow, from footstep_snow_001.ogg, footstep_snow_002.ogg, footstep_snow_003.ogg, footstep_snow_004.ogg | Kenney, Impact Sounds | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `sfx/step-carpet-{1,2,3}.mp3` | Footstep on carpet, from footstep_carpet_000.ogg, footstep_carpet_001.ogg, footstep_carpet_003.ogg | Kenney, Impact Sounds | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `sfx/land-soft-{1,2}.mp3` | Soft landing thud, from impact_soft_medium_001.ogg, impact_soft_medium_003.ogg | Kenney, Impact Sounds | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `sfx/tap-wood-{1,2}.mp3` | Light tap on wood, from impact_wood_light_001.ogg, impact_wood_light_003.ogg | Kenney, Impact Sounds | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `sfx/page-{1,2,3}.mp3` | Page flip, from bookFlip1.ogg, bookFlip2.ogg, bookFlip3.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/book-open.mp3` | Book opening, from bookOpen.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/book-close.mp3` | Book closing, from bookClose.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/cloth-{1,2,3}.mp3` | Cloth rustle, from cloth1.ogg, cloth2.ogg, cloth3.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/metal-click-1.mp3` | Metal click, from metalClick.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/metal-click-2.mp3` | Light metal tap, from impact_metal_light_004.ogg | Kenney, Impact Sounds | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| `sfx/latch.mp3` | Metal latch, from metalLatch.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/creak.mp3` | Wood creak, from creak2.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/door-open.mp3` | Door opening, from doorOpen_1.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/door-close.mp3` | Door closing, from doorClose_4.ogg | Kenney, RPG Audio | CC0 1.0 | https://kenney.nl/assets/rpg-audio |
| `sfx/ui-click-{1,2,3}.mp3` | Soft switch click, from switch_002.ogg, switch_004.ogg, switch_007.ogg | Kenney, Interface Sounds | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `sfx/ui-pop-{1,2}.mp3` | Drop pop, from drop_002.ogg, drop_003.ogg | Kenney, Interface Sounds | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `sfx/ui-toggle-{1,2}.mp3` | Toggle, from toggle_001.ogg, toggle_002.ogg | Kenney, Interface Sounds | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| `inst/glockenspiel-{79,84,91,96,103}.mp3` | Glockenspiel, soft mallet, notes G5, C6, G6, C7, G7 | Versilian Studios LLC, Versilian Community Sample Library | CC0 1.0 | https://github.com/sgossner/VCSL/tree/master/Idiophones/Struck%20Idiophones/Glockenspiel |
| `inst/piano-{55,60,67,72,79}.mp3` | Upright piano (Yamaha), softest layer, notes G3, C4, G4, C5, G5 | Versilian Studios LLC, Versilian Community Sample Library | CC0 1.0 | https://github.com/sgossner/VCSL/tree/master/Chordophones/Zithers/Upright%20Piano%2C%20Yamaha/Sustains |
| `inst/harp-{55,62,69,76,83}.mp3` | Concert harp, mezzo-forte, notes G3, D4, A4, E5, B5 | Versilian Studios LLC, Versilian Community Sample Library | CC0 1.0 | https://github.com/sgossner/VCSL/tree/master/Chordophones/Composite%20Chordophones/Concert%20Harp |
| `inst/ocarina-{69,74,80,85}.mp3` | Ocarina, plain sustain, notes A4, D5, G#5, C#6 | Versilian Studios LLC, Versilian Community Sample Library | CC0 1.0 | https://github.com/sgossner/VCSL/tree/master/Aerophones/Edge-blown%20Aerophones/Ocarina%2C%20Typical/Sustains/Sus |
| `inst/handchimes-{72,78,84,90,96}.mp3` | Hand chimes, notes C5, F#5, C6, F#6, C7 | Versilian Studios LLC, Versilian Community Sample Library | CC0 1.0 | https://github.com/sgossner/VCSL/tree/master/Idiophones/Struck%20Idiophones/Hand%20Chimes |
| `nasa/mars-wind.mp3` | Perseverance Rover's SuperCam Records Wind on Mars | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero | NASA media | https://www.nasa.gov/sounds-from-beyond/ |
| `nasa/ingenuity-hum.mp3` | NASA's Ingenuity Mars Helicopter in Flight | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaéro | NASA media | https://www.nasa.gov/sounds-from-beyond/ |
| `nasa/voyager-plasma.mp3` | Voyager Captures Sounds of Interstellar Space (PIA17045) | NASA/JPL-Caltech/University of Iowa | NASA media | https://science.nasa.gov/photojournal/voyager-captures-sounds-of-interstellar-space |
| `nasa/eagle-landed.mp3` | Apollo 11: "Tranquility Base here. The Eagle has landed." | NASA | Public domain | https://nssdc.gsfc.nasa.gov/planetary/sound/index.html |

## Libraries

| Library | Use | License | Source |
|---|---|---|---|
| three | 3D rendering | MIT | https://github.com/mrdoob/three.js |
| svelte | 2D UI layer | MIT | https://github.com/sveltejs/svelte |
| partyserver | Co-op rooms on Durable Objects | ISC | https://github.com/cloudflare/partykit |
| partysocket | Reconnecting WebSocket client | MIT | https://github.com/cloudflare/partykit |
| roughjs | Hand-drawn shapes in the notebook and UI | MIT | https://github.com/rough-stuff/rough |
| perfect-freehand | Pen strokes | MIT | https://github.com/steveruizok/perfect-freehand |
| @fontsource packages | Source of the self-hosted font files, build time only | MIT (fonts: SIL OFL 1.1) | https://github.com/fontsource/fontsource |
| axe-core, @axe-core/playwright | Accessibility checks in tests, never shipped | MPL-2.0 | https://github.com/dequelabs/axe-core |
| vite | Build tool | MIT | https://github.com/vitejs/vite |
| @cloudflare/vite-plugin, wrangler | Workers runtime and deploy | MIT; MIT OR Apache-2.0 | https://github.com/cloudflare/workers-sdk |
| vitest | Unit tests | MIT | https://github.com/vitest-dev/vitest |
| @playwright/test | Browser tests and screenshots | Apache-2.0 | https://github.com/microsoft/playwright |
| typescript | Type checking | Apache-2.0 | https://github.com/microsoft/TypeScript |
| @gltf-transform (core, functions, extensions) | Model pipeline, build time only | MIT | https://github.com/donmccurdy/glTF-Transform |
| meshoptimizer | Model simplify and compress, build time only | MIT | https://github.com/zeux/meshoptimizer |
| draco3dgltf | Reads Draco NASA models, build time only | Apache-2.0 | https://github.com/google/draco |

## Technique reference

We studied the open techniques behind tiny-planet games (toon shading, outline post-processing, boiling-line loaders). All code and assets here are our own. Nothing is copied from any other game.
