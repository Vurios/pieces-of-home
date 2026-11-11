/**
 * Keyboard and gamepad helpers for the 2D layer.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Svelte action: keeps Tab inside a dialog, focuses its first control, and
 * gives focus back to whatever had it when the dialog closes.
 */
export function trap(node: HTMLElement, options: { initial?: string } = {}): { destroy(): void } {
  const before = document.activeElement as HTMLElement | null;
  const first = (options.initial ? node.querySelector<HTMLElement>(options.initial) : null) ?? focusables(node)[0];
  queueMicrotask(() => first?.focus({ preventScroll: true }));
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;
    const list = focusables(node);
    if (list.length === 0) return;
    const firstEl = list[0]!;
    const lastEl = list[list.length - 1]!;
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  };
  node.addEventListener("keydown", onKey);
  return {
    destroy() {
      node.removeEventListener("keydown", onKey);
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    },
  };
}

/** Moves focus to the nearest control in a direction, the way a gamepad d-pad should. */
export function moveFocus(root: HTMLElement, dx: number, dy: number): void {
  const list = focusables(root);
  if (list.length === 0) return;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !root.contains(current)) {
    list[0]!.focus();
    return;
  }
  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const vx = b.left + b.width / 2 - ax;
    const vy = b.top + b.height / 2 - ay;
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  best?.focus();
}

/**
 * Lets a gamepad drive the menus: d-pad or stick moves focus, A presses,
 * B goes back (Escape), shoulder buttons turn notebook pages.
 * Returns a stop function.
 */
export function gamepadNav(getRoot: () => HTMLElement | null, onBack: () => void, onShoulder?: (dir: -1 | 1) => void): () => void {
  // Polled on a timer, not once a frame: when the 3D world is slow to draw,
  // menus still catch every press.
  const held = new Map<string, number>();
  // Directions repeat when held, like a keyboard. Buttons fire once per press.
  const press = (key: string, down: boolean, now: number, repeat = false): boolean => {
    if (!down) {
      held.delete(key);
      return false;
    }
    const since = held.get(key);
    if (since === undefined) {
      held.set(key, now);
      return true;
    }
    if (repeat && now - since > 420) {
      held.set(key, now - 300);
      return true;
    }
    return false;
  };
  let last = performance.now();
  const tick = (): void => {
    const now = performance.now();
    // After a stall (one slow frame of the 3D world), a held direction starts
    // its repeat wait again, so a single press never jumps two places.
    if (now - last > 150) for (const key of held.keys()) held.set(key, now);
    last = now;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    const root = getRoot();
    if (!pad || !root) return;
    const b = (i: number): boolean => Boolean(pad.buttons[i]?.pressed);
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (press("up", b(12) || ay < -0.6, now, true)) moveFocus(root, 0, -1);
    if (press("down", b(13) || ay > 0.6, now, true)) moveFocus(root, 0, 1);
    if (press("left", b(14) || ax < -0.6, now, true)) moveFocus(root, -1, 0);
    if (press("right", b(15) || ax > 0.6, now, true)) moveFocus(root, 1, 0);
    if (press("a", b(0), now)) {
      const el = document.activeElement as HTMLElement | null;
      if (el && root.contains(el)) el.click();
      else focusables(root)[0]?.focus();
    }
    if (press("b", b(1), now)) onBack();
    if (onShoulder && press("lb", b(4), now)) onShoulder(-1);
    if (onShoulder && press("rb", b(5), now)) onShoulder(1);
  };
  const timer = window.setInterval(tick, 40);
  return () => window.clearInterval(timer);
}
