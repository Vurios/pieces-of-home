/**
 * Gives the browser a turn: it can paint a frame, run the loading page's
 * animations and answer input before the next slice of heavy work. Long
 * builds (a whole world, the shaders) are cut into slices with this, so the
 * page never freezes for a second at a time.
 */
export function nextTask(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}
