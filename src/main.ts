import { mount } from "svelte";
import { createStage } from "./game/stage";
import { NetClient } from "./net/client";
import { isValidRoomCode } from "./net/protocol";
import App from "./ui/App.svelte";

/**
 * Boot: start the 3D stage, mount the 2D UI layer, hand off from the inline
 * loader, and join a co-op room only when the link asks for one.
 */
function boot(): void {
  const root = document.documentElement;
  const canvas = document.querySelector<HTMLCanvasElement>("#stage");
  const ui = document.querySelector<HTMLElement>("#ui");
  const bootScreen = document.querySelector<HTMLElement>("#boot");
  const bootLine = document.querySelector<HTMLElement>("#boot-line");
  if (!canvas || !ui) throw new Error("Missing #stage or #ui in index.html");

  const net = new NetClient();
  net.subscribe((state) => {
    root.dataset["net"] = state.status;
    root.dataset["players"] = String(state.players);
  });

  const stage = createStage(canvas);
  if (!stage) {
    root.dataset["stage"] = "unsupported";
    if (bootLine) bootLine.textContent = "This device cannot draw the 3D worlds yet. The Field Guide is coming soon.";
    return;
  }
  root.dataset["stage"] = "ready";

  mount(App, { target: ui, props: { net, version: __APP_VERSION__ } });

  const room = new URLSearchParams(window.location.search).get("room");
  if (room && isValidRoomCode(room)) net.join(room);

  bootScreen?.setAttribute("data-done", "");
}

boot();
