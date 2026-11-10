/**
 * NASA hardware model pipeline.
 *
 *   npx tsx scripts/assets/nasa-models.ts inspect [id...]
 *   npx tsx scripts/assets/nasa-models.ts build [id...] [--out public/models]
 *
 * 1. Downloads each model in models.json from github.com/nasa/NASA-3D-Resources
 *    into .cache/nasa-models/ (Git LFS files are fetched from the media host).
 * 2. inspect: prints meshes, triangles, materials, textures and size.
 * 3. build: welds, simplifies with meshoptimizer to the model's `ratio`, drops
 *    textures and materials (the game paints models with its own toon
 *    material), quantizes, and writes a small GLB. Default output is
 *    .cache/nasa-models/out/ so nothing ships until a phase chooses to;
 *    pass --out public/models to ship, then add the credit to CREDITS.md and
 *    src/data/credits.json (the script prints the entry).
 *
 * If a NASA model is too heavy or off-style even after this, rebuild it
 * low-poly in code from NASA photos and keep the silhouette faithful.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, quantize, simplify, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

interface ModelEntry {
  id: string;
  folder: string;
  file: string;
  ratio: number;
  credit: string;
  page: string;
}

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "scripts/assets/models.json"), "utf8")) as { models: ModelEntry[] };
const cacheDir = join(root, ".cache/nasa-models");
mkdirSync(cacheDir, { recursive: true });

const args = process.argv.slice(2);
const command = args[0] ?? "inspect";
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? join(root, args[outIndex + 1] ?? "public/models") : join(cacheDir, "out");
const ids = args.slice(1).filter((arg, i, all) => !arg.startsWith("--") && all[i - 1] !== "--out");
const selected = ids.length > 0 ? manifest.models.filter((m) => ids.includes(m.id)) : manifest.models;

function rawUrl(entry: ModelEntry, media: boolean): string {
  const path = ["3D Models", entry.folder, entry.file].map(encodeURIComponent).join("/");
  return media
    ? `https://media.githubusercontent.com/media/nasa/NASA-3D-Resources/master/${path}`
    : `https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/${path}`;
}

async function download(entry: ModelEntry): Promise<string> {
  const file = join(cacheDir, `${entry.id}.glb`);
  if (existsSync(file) && statSync(file).size > 1024) return file;
  for (const media of [false, true]) {
    const response = await fetch(rawUrl(entry, media));
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    // A Git LFS pointer is a short text file, not a GLB ("glTF" magic).
    const isGlb = bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
    if (!isGlb) continue;
    writeFileSync(file, bytes);
    return file;
  }
  throw new Error(`Could not download a GLB for ${entry.id}`);
}

function stats(doc: Document): { meshes: number; triangles: number; materials: number; textures: number } {
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const index = prim.getIndices();
      const position = prim.getAttribute("POSITION");
      triangles += Math.floor((index ? index.getCount() : (position?.getCount() ?? 0)) / 3);
    }
  }
  const r = doc.getRoot();
  return { meshes: r.listMeshes().length, triangles, materials: r.listMaterials().length, textures: r.listTextures().length };
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
// Some NASA models are Draco-compressed, so the reader needs a decoder.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule(), "meshopt.encoder": MeshoptEncoder });

for (const entry of selected) {
  const file = await download(entry);
  const doc = await io.read(file);
  const before = stats(doc);
  const size = statSync(file).size;
  console.log(`${entry.id}: ${before.meshes} meshes, ${before.triangles} triangles, ${before.materials} materials, ${before.textures} textures, ${(size / 1024).toFixed(0)} KB`);
  if (command !== "build") continue;

  // Write plain quantized meshes. Three.js reads them with no extra decoder.
  for (const extension of doc.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === "KHR_draco_mesh_compression") extension.dispose();
  }
  // The game paints every model with its own toon material, so textures go.
  for (const texture of doc.getRoot().listTextures()) texture.dispose();
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    for (const semantic of prim.listSemantics()) {
      if (semantic !== "POSITION" && semantic !== "NORMAL") prim.setAttribute(semantic, null);
    }
  }
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: entry.ratio, error: 0.01 }),
    dedup(),
    prune(),
    quantize(),
    // EXT_meshopt_compression: load with GLTFLoader.setMeshoptDecoder(MeshoptDecoder).
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  const after = stats(doc);
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, `${entry.id}.glb`);
  await io.write(target, doc);
  const outSize = statSync(target).size;
  console.log(`  -> ${target}: ${after.triangles} triangles, ${(outSize / 1024).toFixed(0)} KB`);
  console.log(
    `  credit: ${JSON.stringify({ name: entry.folder, file: `models/${entry.id}.glb`, credit: entry.credit, license: "NASA media (not copyrighted in the US). No endorsement implied.", sourceUrl: rawUrl(entry, false), page: entry.page })}`,
  );
}
