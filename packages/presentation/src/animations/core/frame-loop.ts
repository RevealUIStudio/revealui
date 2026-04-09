/**
 * Shared animation frame loop.
 *
 * All animations share a single requestAnimationFrame loop
 * to minimize frame overhead. Callbacks are added/removed
 * as animations start/complete.
 */

type FrameCallback = (dt: number) => void;

let running = false;
let lastTime = 0;
const callbacks = new Set<FrameCallback>();

function tick(time: number): void {
  if (callbacks.size === 0) {
    running = false;
    return;
  }

  // Cap dt at 64ms (~15fps) to prevent spiral of death
  const dt = Math.min((time - lastTime) / 1000, 0.064);
  lastTime = time;

  // Copy to array to allow safe removal during iteration
  const batch = Array.from(callbacks);
  for (const cb of batch) {
    cb(dt);
  }

  requestAnimationFrame(tick);
}

/** Add a callback to the shared frame loop. Returns cleanup function. */
export function onFrame(callback: FrameCallback): () => void {
  callbacks.add(callback);

  if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(tick);
  }

  return () => {
    callbacks.delete(callback);
  };
}

/** Number of active callbacks (useful for debugging) */
export function activeCount(): number {
  return callbacks.size;
}
