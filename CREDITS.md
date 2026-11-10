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
| Kalam | Dad's handwriting and the loading page | SIL Open Font License 1.1 | Indian Type Foundry | https://github.com/itfoundry/kalam |
| Atkinson Hyperlegible Next | Reading text | SIL Open Font License 1.1 | Braille Institute of America | https://www.brailleinstitute.org/freefont/ |
| Zilla Slab | Museum labels, tags and stamps | SIL Open Font License 1.1 | Mozilla, Typotheque | https://github.com/mozilla/zilla-slab |
| OpenDyslexic | Optional reading font | SIL Open Font License 1.1 | Abbie Gonzalez | https://opendyslexic.org |

## Audio

All music and sound effects are made in code at runtime with the Web Audio API. No recorded or copyrighted audio.

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
