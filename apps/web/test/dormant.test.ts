import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { setupDom } from "@agenteschat/ui/testing/dom";

setupDom();

import { focusManager } from "@tanstack/react-query";
import { DORMANT_AFTER_MS, isDormant, watchDormancy } from "../src/lib/dormant";

describe("quiet idle tab (Wyrd-OS)", () => {
  let clock = 0;
  let busy = false;
  let calls: string[] = [];
  let stop: () => void;
  // The checks run every 30 s: advance the fake timers and the clock together.
  const pass = (ms: number) => {
    clock += ms;
    jest.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    clock = 1_000_000;
    busy = false;
    calls = [];
    stop = watchDormancy({
      busy: () => busy,
      sleep: () => calls.push("sleep"),
      wake: () => calls.push("wake"),
      now: () => clock,
    });
  });

  afterEach(() => {
    stop();
    jest.useRealTimers();
  });

  test("goes quiet only once the whole idle time has passed, and pauses polling", () => {
    pass(DORMANT_AFTER_MS - 30_000);
    expect(calls).toEqual([]);
    pass(30_000);
    expect(calls).toEqual(["sleep"]);
    expect(isDormant()).toBe(true);
    expect(focusManager.isFocused()).toBe(false);
    pass(DORMANT_AFTER_MS);
    expect(calls).toEqual(["sleep"]);
  });

  test("stays connected while an agent works, and goes quiet once it stops", () => {
    busy = true;
    pass(DORMANT_AFTER_MS * 2);
    expect(calls).toEqual([]);
    busy = false;
    pass(30_000);
    expect(calls).toEqual(["sleep"]);
  });

  test("input keeps it awake, and the first input after going quiet wakes it once", () => {
    pass(DORMANT_AFTER_MS - 60_000);
    window.dispatchEvent(new Event("keydown"));
    pass(60_000);
    expect(calls).toEqual([]);
    pass(DORMANT_AFTER_MS);
    expect(calls).toEqual(["sleep"]);
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("keydown"));
    expect(calls).toEqual(["sleep", "wake"]);
    expect(isDormant()).toBe(false);
    expect(focusManager.isFocused()).toBe(true);
    // The idle time counts again from that input.
    pass(DORMANT_AFTER_MS - 30_000);
    expect(calls).toEqual(["sleep", "wake"]);
  });
});
