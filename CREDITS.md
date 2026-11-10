# Credits

Every asset and library in Pieces of Home is listed here and in `src/data/credits.json`, with its source and license.

NASA is credited as a source of images, models and data. NASA does not sponsor or endorse this project. The NASA insignia, logotype and seal are not used.

## Images, models and textures

| Asset | Credit | License | Source |
|---|---|---|---|
| Moon globe map (`textures/globes/moon.jpg`), CGI Moon Kit color map, unchanged | NASA's Scientific Visualization Studio | Public domain | https://svs.gsfc.nasa.gov/4720 |
| Mars globe map (`textures/globes/mars.jpg`), Viking MDIM 2.1 colorized global mosaic, downscaled to 1024 by 512 | NASA Ames / USGS Astrogeology Science Center | Public domain | https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m |

No NASA 3D model ships yet. The pipeline in `scripts/assets/` prints the credit line for each model when one is added.

## Fonts

None yet. Only fonts under the SIL Open Font License will be used, self-hosted.

## Audio

All music and sound effects are made in code at runtime with the Web Audio API. No recorded or copyrighted audio.

## Libraries

| Library | Use | License | Source |
|---|---|---|---|
| three | 3D rendering | MIT | https://github.com/mrdoob/three.js |
| svelte | 2D UI layer | MIT | https://github.com/sveltejs/svelte |
| partyserver | Co-op rooms on Durable Objects | ISC | https://github.com/cloudflare/partykit |
| partysocket | Reconnecting WebSocket client | MIT | https://github.com/cloudflare/partykit |
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
