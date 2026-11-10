import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { loaderPlugin } from "./scripts/vite/loader-plugin";
import { pagesPlugin } from "./scripts/vite/pages-plugin";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  plugins: [loaderPlugin(), pagesPlugin(), svelte(), cloudflare()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
  environments: {
    // Only the browser build has HTML pages; the Worker keeps its own entry.
    client: {
      build: {
        rollupOptions: {
          // The game, plus two plain pages built from the same data: the Field Guide and About.
          input: {
            main: fileURLToPath(new URL("./index.html", import.meta.url)),
            guide: fileURLToPath(new URL("./field-guide/index.html", import.meta.url)),
            about: fileURLToPath(new URL("./about/index.html", import.meta.url)),
          },
        },
      },
    },
  },
});
