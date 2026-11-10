import { mount } from "svelte";
import { Engine } from "./game/engine";
import { NetClient } from "./net/client";
import { isValidRoomCode } from "./net/protocol";
import App from "./ui/App.svelte";

/**
 * Boot: start the engine, mount the 2D UI layer, hand off from the inline
 * loader, and join a co-op room only when the link asks for one.
 */
async function boot(): Promise<void> {
  const root = document.documentElement;
  const canvas = document.querySelector<HTMLCanvasElement>("#stage");
  const ui = document.querySelector<HTMLElement>("#ui");
  const bootScreen = document.querySelector<HTMLElement>("#boot");
  const bootLine = document.querySelector<HTMLElement>("#boot-line");
  if (!canvas || !ui) throw new Error("Missing #stage or #ui in index.html");

  const params = new URLSearchParams(window.location.search);
  const net = new NetClient();
  net.subscribe((state) => {
    root.dataset["net"] = state.status;
    root.dataset["players"] = String(state.players);
  });

  const engine = Engine.create({
    canvas,
    debug: import.meta.env.DEV || params.has("debug"),
    shot: params.get("shot"),
  });
  if (!engine) {
    root.dataset["stage"] = "unsupported";
    if (bootLine) bootLine.textContent = "This device cannot draw the 3D worlds yet. The Field Guide is coming soon.";
    return;
  }
  if (import.meta.env.DEV || params.has("test")) {
    (window as unknown as { __poh: unknown }).__poh = engine.debugApi();
  }

  mount(App, { target: ui, props: { net, engine, version: __APP_VERSION__, debug: import.meta.env.DEV || params.has("debug") } });

  await engine.loadWorld("home");
  engine.start();
  root.dataset["stage"] = "ready";
  root.dataset["tier"] = engine.quality.tier;
  engine.bus.on("quality:change", ({ tier }) => (root.dataset["tier"] = tier));

  const room = params.get("room");
  if (room && isValidRoomCode(room)) net.join(room);

  bootScreen?.setAttribute("data-done", "");
}

void boot();
