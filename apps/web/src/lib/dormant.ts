import { focusManager } from "@tanstack/react-query";

/**
 * Wyrd-OS (MODIFICATIONS.md): a tab nobody has touched for a while, with no agent working, goes quiet. It closes its
 * live connection and its queries stop polling, so the machine the server runs on can pause when idle (a provider
 * counts that traffic as activity). Any key, click, pointer move, scroll, focus or return to the tab wakes it: the
 * connection opens again and what is on screen reads again.
 */
export const DORMANT_AFTER_MS = 5 * 60_000;
const CHECK_EVERY_MS = 30_000;
const INPUTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll", "focus"] as const;

let dormant = false;

/** Whether this tab is quiet now: periodic checks of the server skip while it is. */
export const isDormant = () => dormant;

/** Watches this tab: `sleep` when it goes quiet, `wake` on the first input after. `busy`: an agent is working. */
export function watchDormancy({
  busy,
  sleep,
  wake,
  now = () => Date.now(),
}: {
  busy: () => boolean;
  sleep: () => void;
  wake: () => void;
  now?: () => number;
}): () => void {
  let lastInput = now();
  const touch = () => {
    lastInput = now();
    if (!dormant) return;
    dormant = false;
    // Back to the browser's own focus and visibility: refetches what went stale meanwhile.
    focusManager.setFocused(undefined);
    wake();
  };
  const visible = () => {
    if (document.visibilityState === "visible") touch();
  };
  const check = () => {
    if (dormant || busy() || now() - lastInput < DORMANT_AFTER_MS) return;
    dormant = true;
    focusManager.setFocused(false);
    sleep();
  };
  for (const type of INPUTS) window.addEventListener(type, touch, { passive: true, capture: true });
  document.addEventListener("visibilitychange", visible);
  const timer = setInterval(check, CHECK_EVERY_MS);
  return () => {
    clearInterval(timer);
    for (const type of INPUTS) window.removeEventListener(type, touch, { capture: true });
    document.removeEventListener("visibilitychange", visible);
    if (dormant) {
      dormant = false;
      focusManager.setFocused(undefined);
    }
  };
}
