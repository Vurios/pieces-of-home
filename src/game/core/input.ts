import type { GameBus, InputDevice } from "./events";
import { readStorage, writeStorage } from "./state";

/** Things a player can do. One interact button, as the Game Bible asks. */
export type Action = "forward" | "back" | "left" | "right" | "jump" | "interact" | "run";

export type KeyBindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: KeyBindings = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  interact: ["KeyE", "Enter"],
  run: ["ShiftLeft", "ShiftRight"],
};

const ACTIONS = Object.keys(DEFAULT_BINDINGS) as Action[];
const BINDINGS_KEY = "poh.keys";

/** Merges saved bindings over the defaults. Bad data falls back to defaults. */
export function reviveBindings(raw: unknown): KeyBindings {
  const result = structuredClone(DEFAULT_BINDINGS);
  if (typeof raw !== "object" || raw === null) return result;
  for (const action of ACTIONS) {
    const codes = (raw as Record<string, unknown>)[action];
    if (Array.isArray(codes) && codes.length > 0 && codes.length <= 4 && codes.every((c) => typeof c === "string")) {
      result[action] = codes as string[];
    }
  }
  return result;
}

export function loadBindings(): KeyBindings {
  try {
    return reviveBindings(JSON.parse(readStorage(BINDINGS_KEY) ?? "null"));
  } catch {
    return structuredClone(DEFAULT_BINDINGS);
  }
}

export function saveBindings(bindings: KeyBindings): void {
  writeStorage(BINDINGS_KEY, JSON.stringify(bindings));
}

/** What the game reads each frame. */
export interface InputFrame {
  /** Strafe, -1 (left) to 1 (right). */
  moveX: number;
  /** Forward, -1 (back) to 1 (forward). */
  moveY: number;
  run: boolean;
  /** True only on the frame the button went down. */
  jumpPressed: boolean;
  interactPressed: boolean;
  interactHeld: boolean;
  /** Camera orbit this frame, in radians. */
  lookX: number;
  lookY: number;
  /** Zoom this frame: above 0 pulls the camera back, below 0 brings it in. */
  zoom: number;
}

export interface TouchStick {
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

const STICK_RADIUS = 56;
const DEADZONE = 0.18;

function applyDeadzone(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude < DEADZONE) return 0;
  return (Math.sign(value) * (magnitude - DEADZONE)) / (1 - DEADZONE);
}

/**
 * Collects keyboard, mouse, touch and gamepad into one frame of input.
 * The touch joystick appears where the left thumb lands. Dragging anywhere
 * else turns the camera.
 */
export class Input {
  bindings: KeyBindings = loadBindings();
  readonly stick: TouchStick = { active: false, originX: 0, originY: 0, x: 0, y: 0 };
  device: InputDevice = "keyboard";
  /** Mouse wheel zoom collected since the last frame. */
  private zoom = 0;
  private onWheel = (event: WheelEvent): void => {
    const lines = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? 400 : 1;
    this.zoom += Math.max(-0.5, Math.min(0.5, (event.deltaY * lines) / 900));
  };
  /** How far the player has turned the camera, in total. The tips use it to see that "look" was learned. */
  lookTravel = 0;

  private keys = new Set<string>();
  private pressed = new Set<Action>();
  private virtualHeld = new Set<Action>();
  private lookX = 0;
  private lookY = 0;
  private stickPointer: number | null = null;
  private lookPointers = new Map<number, { x: number; y: number }>();
  private padButtons: boolean[] = [];
  private abort = new AbortController();
  private stickListeners = new Set<(stick: TouchStick) => void>();

  constructor(
    private element: HTMLElement,
    private bus: GameBus,
  ) {
    const signal = this.abort.signal;
    window.addEventListener("keydown", this.onKeyDown, { signal });
    window.addEventListener("keyup", this.onKeyUp, { signal });
    window.addEventListener("blur", this.releaseAll, { signal });
    document.addEventListener("visibilitychange", this.releaseAll, { signal });
    element.addEventListener("pointerdown", this.onPointerDown, { signal });
    element.addEventListener("pointermove", this.onPointerMove, { signal });
    element.addEventListener("pointerup", this.onPointerUp, { signal });
    element.addEventListener("pointercancel", this.onPointerUp, { signal });
    element.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
    element.addEventListener("wheel", this.onWheel, { signal, passive: true });
    window.addEventListener("gamepadconnected", () => this.setDevice("gamepad"), { signal });
  }

  dispose(): void {
    this.abort.abort();
    this.stickListeners.clear();
  }

  onStick(listener: (stick: TouchStick) => void): () => void {
    this.stickListeners.add(listener);
    return () => this.stickListeners.delete(listener);
  }

  /** For on-screen buttons. */
  setVirtual(action: Action, down: boolean): void {
    if (down) {
      if (!this.virtualHeld.has(action)) this.pressed.add(action);
      this.virtualHeld.add(action);
      this.setDevice("touch");
    } else {
      this.virtualHeld.delete(action);
    }
  }

  rebind(action: Action, codes: string[]): void {
    this.bindings = { ...this.bindings, [action]: codes };
    saveBindings(this.bindings);
  }

  /** Reads and clears one frame of input. Call once per frame. */
  read(): InputFrame {
    let moveX = 0;
    let moveY = 0;
    if (this.held("left")) moveX -= 1;
    if (this.held("right")) moveX += 1;
    if (this.held("forward")) moveY += 1;
    if (this.held("back")) moveY -= 1;
    let run = this.held("run");

    if (this.stick.active) {
      const dx = (this.stick.x - this.stick.originX) / STICK_RADIUS;
      const dy = (this.stick.y - this.stick.originY) / STICK_RADIUS;
      moveX += applyDeadzone(Math.max(-1, Math.min(1, dx)));
      moveY -= applyDeadzone(Math.max(-1, Math.min(1, dy)));
      // Push the stick all the way to run.
      if (Math.hypot(dx, dy) > 0.92) run = true;
    }

    let lookX = this.lookX;
    let lookY = this.lookY;
    this.lookX = 0;
    this.lookY = 0;

    const pad = this.readGamepad();
    if (pad) {
      moveX += pad.moveX;
      moveY += pad.moveY;
      lookX += pad.lookX;
      lookY += pad.lookY;
      run = run || pad.run;
    }

    this.lookTravel += Math.abs(lookX) + Math.abs(lookY);

    const length = Math.hypot(moveX, moveY);
    if (length > 1) {
      moveX /= length;
      moveY /= length;
    }

    const frame: InputFrame = {
      moveX,
      moveY,
      run,
      jumpPressed: this.pressed.has("jump"),
      interactPressed: this.pressed.has("interact"),
      interactHeld: this.held("interact") || (pad?.interact ?? false),
      lookX,
      lookY,
      zoom: this.zoom,
    };
    this.zoom = 0;
    this.pressed.clear();
    return frame;
  }

  private held(action: Action): boolean {
    if (this.virtualHeld.has(action)) return true;
    for (const code of this.bindings[action]) if (this.keys.has(code)) return true;
    return false;
  }

  private setDevice(device: InputDevice): void {
    if (this.device === device) return;
    this.device = device;
    this.bus.emit("input:device", { device });
  }

  private actionFor(code: string): Action | null {
    for (const action of ACTIONS) if (this.bindings[action].includes(code)) return action;
    return null;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
    const action = this.actionFor(event.code);
    if (!action) return;
    // Keep Space and arrows from scrolling the page, but let buttons keep Enter and Space.
    if (target?.tagName !== "BUTTON") event.preventDefault();
    else if (action === "interact" || action === "jump") return;
    if (!event.repeat && !this.keys.has(event.code)) this.pressed.add(action);
    this.keys.add(event.code);
    this.setDevice("keyboard");
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private releaseAll = (): void => {
    this.keys.clear();
    this.virtualHeld.clear();
    this.pressed.clear();
    this.lookPointers.clear();
    this.stickPointer = null;
    this.setStick(false, 0, 0);
  };

  private setStick(active: boolean, x: number, y: number, origin = false): void {
    this.stick.active = active;
    this.stick.x = x;
    this.stick.y = y;
    if (origin) {
      this.stick.originX = x;
      this.stick.originY = y;
    }
    for (const listener of this.stickListeners) listener(this.stick);
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.element.setPointerCapture?.(event.pointerId);
    if (event.pointerType === "touch") {
      this.setDevice("touch");
      const rect = this.element.getBoundingClientRect();
      const leftSide = event.clientX - rect.left < rect.width * 0.5;
      if (leftSide && this.stickPointer === null) {
        this.stickPointer = event.pointerId;
        this.setStick(true, event.clientX, event.clientY, true);
        return;
      }
    }
    this.lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.stickPointer) {
      // Let the stick base follow a thumb that drags far.
      const dx = event.clientX - this.stick.originX;
      const dy = event.clientY - this.stick.originY;
      const distance = Math.hypot(dx, dy);
      if (distance > STICK_RADIUS * 1.6) {
        const pull = (distance - STICK_RADIUS * 1.6) / distance;
        this.stick.originX += dx * pull;
        this.stick.originY += dy * pull;
      }
      this.setStick(true, event.clientX, event.clientY);
      return;
    }
    const last = this.lookPointers.get(event.pointerId);
    if (!last) return;
    const scale = event.pointerType === "touch" ? 0.006 : 0.0045;
    this.lookX += (event.clientX - last.x) * scale;
    this.lookY += (event.clientY - last.y) * scale;
    last.x = event.clientX;
    last.y = event.clientY;
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.stickPointer) {
      this.stickPointer = null;
      this.setStick(false, 0, 0);
    }
    this.lookPointers.delete(event.pointerId);
  };

  private readGamepad(): { moveX: number; moveY: number; lookX: number; lookY: number; run: boolean; interact: boolean } | null {
    const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const candidate of pads) {
      if (candidate && candidate.connected) {
        pad = candidate;
        break;
      }
    }
    if (!pad) return null;

    const axis = (index: number): number => applyDeadzone(pad.axes[index] ?? 0);
    const button = (index: number): boolean => pad.buttons[index]?.pressed ?? false;
    const edge = (index: number, action: Action): void => {
      const down = button(index);
      if (down && !this.padButtons[index]) this.pressed.add(action);
      this.padButtons[index] = down;
    };

    // Standard mapping: 0 = A, 2 = X, 1 = B.
    edge(0, "jump");
    edge(2, "interact");
    edge(1, "interact");

    const moveX = axis(0) + (button(15) ? 1 : 0) - (button(14) ? 1 : 0);
    const moveY = -axis(1) + (button(12) ? 1 : 0) - (button(13) ? 1 : 0);
    const run = button(5) || button(7) || button(10) || Math.hypot(axis(0), axis(1)) > 0.95;
    const active = moveX !== 0 || moveY !== 0 || axis(2) !== 0 || axis(3) !== 0 || button(0) || button(2);
    if (active) this.setDevice("gamepad");

    return {
      moveX,
      moveY,
      lookX: axis(2) * 0.045,
      lookY: axis(3) * 0.03,
      run,
      interact: button(2) || button(1),
    };
  }
}
