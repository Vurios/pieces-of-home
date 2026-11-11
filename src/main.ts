import "./ui/theme.css";
import { mount } from "svelte";
import { WORLDS } from "./game/worlds/registry";
import { LoadingManager } from "three";
import { audio } from "./audio/audio";
import { BootProgress } from "./boot/progress";
import { Engine } from "./game/engine";
import { NetClient } from "./net/client";
import { isValidRoomCode } from "./net/protocol";
import App from "./ui/App.svelte";
import { flow } from "./ui/flow.svelte";
import { settings } from "./ui/settings.svelte";

/**
 * Boot: real progress drives the loader's lamp, then "Turn on the light"
 * unlocks sound and hands off to the 3D title. Screenshot and test links
 * (`?shot=`, `?test`) skip straight to play unless `?intro` is added.
 */
async function boot(): Promise<void> {
  const root = document.documentElement;
  const loader = window.__pohBoot;
  const canvas = document.querySelector<HTMLCanvasElement>("#stage");
  const ui = document.querySelector<HTMLElement>("#ui");
  if (!canvas || !ui) throw new Error("Missing #stage or #ui in index.html");

  const params = new URLSearchParams(window.location.search);
  const skipIntro = params.has("shot") || params.has("skip") || (params.has("test") && !params.has("intro"));

  // Weighted milestones, in the order the margin list writes them.
  const progress = new BootProgress((value) => loader?.progress(value));
  const engineTask = progress.task(1);
  const worldTask = progress.task(6, () => loader?.milestone(0));
  const textureTask = progress.task(2, () => loader?.milestone(1));
  const audioTask = progress.task(1, () => loader?.milestone(2));
  const fontTask = progress.task(1);
  const uiTask = progress.task(1, () => loader?.milestone(3));

  const manager = new LoadingManager();
  let texturesStarted = false;
  manager.onStart = () => (texturesStarted = true);
  manager.onProgress = (_url, loaded, total) => textureTask.set(total > 0 ? loaded / total : 1);
  manager.onLoad = () => textureTask.done();
  manager.onError = () => undefined;

  const net = new NetClient();
  net.subscribe((state) => {
    root.dataset["net"] = state.status;
    root.dataset["players"] = String(state.players);
  });

  const engine = Engine.create({
    canvas,
    debug: import.meta.env.DEV || params.has("debug"),
    shot: params.get("shot"),
    loading: manager,
  });
  if (!engine) {
    root.dataset["stage"] = "unsupported";
    loader?.fail();
    return;
  }
  engineTask.done();
  if (import.meta.env.DEV || params.has("test")) {
    (window as unknown as { __poh: unknown }).__poh = { ...engine.debugApi(), flow: () => flow.stage };
  }

  // Fonts and the audio click render while the world builds.
  const faces = ['700 20px "Kalam"', '400 20px "Atkinson Hyperlegible Next"', '700 20px "Zilla Slab"'];
  let facesDone = 0;
  const fonts = Promise.all(
    faces.map((face) =>
      document.fonts
        .load(face)
        .catch(() => [])
        .then(() => fontTask.set(++facesDone / faces.length)),
    ),
  );
  const sounds = audio
    .prepare()
    .catch(() => undefined)
    .then(() => audioTask.done());

  // Test and screenshot links can start in another world: `?world=tranquility`.
  const startWorld = params.get("world");
  await engine.loadWorld(skipIntro && startWorld && startWorld in WORLDS ? startWorld : "home");
  worldTask.done();
  if (!texturesStarted) textureTask.done();
  await Promise.all([fonts, sounds]);

  mount(App, { target: ui, props: { net, engine, version: __APP_VERSION__, debug: import.meta.env.DEV || params.has("debug") } });
  uiTask.done();
  // Wait for the last textures, so the globes are never blank on the first frame.
  if (!textureTask.finished) await new Promise<void>((resolve) => (manager.onLoad = () => (textureTask.done(), resolve())));

  root.dataset["tier"] = engine.quality.tier;
  engine.bus.on("quality:change", ({ tier }) => (root.dataset["tier"] = tier));
  engine.bus.on("title:note", ({ index }) => audio.note(index));
  // Sound follows the game: feet, letters, worlds, and the camera as the ears.
  audio.attach(engine.bus, engine.quality.tier);
  engine.onFrame = (frame) => audio.frame(frame);
  // One more instrument in the music for each friend in the room, and a chime as they come and go.
  let friends = 0;
  net.subscribe(({ players, status }) => {
    const next = status === "connected" ? Math.max(0, players - 1) : 0;
    if (next > friends) audio.play("join-chime");
    else if (next < friends) audio.play("leave-chime");
    friends = next;
    audio.setFriends(next);
  });

  const room = params.get("room");
  if (room && isValidRoomCode(room)) net.join(room);

  if (skipIntro) {
    engine.start();
    loader?.hide();
    flow.setStage("play");
    return;
  }

  // The camera waits on the lamp's glow behind the paper until the light is turned on.
  engine.veiled = Boolean(loader);
  engine.startTitle();
  await engine.warm();
  engine.start();
  flow.setStage("waiting");
  loader?.ready(() => {
    engine.veiled = false;
    settings.apply();
    loader.leave();
    flow.setStage("title");
    engine.playTitle();
    // Still inside the click, tap or key press: sound is allowed from here on.
    void audio.unlock().then(() => {
      audio.lampClick();
      audio.setHum(1);
    });
  });
}

void boot();
