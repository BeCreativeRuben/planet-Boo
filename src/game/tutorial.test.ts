import { beforeEach, describe, expect, it } from "vitest";

import {
  TUTORIAL_STEPS,
  isTutorialDone,
  markTutorialDone,
  resetTutorialDone,
} from "./tutorial";

describe("tutorial", () => {
  beforeEach(() => resetTutorialDone());

  it("has a short skippable tour", () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(TUTORIAL_STEPS.length).toBeLessThanOrEqual(6);
  });

  it("persists completion", () => {
    expect(isTutorialDone()).toBe(false);
    markTutorialDone();
    expect(isTutorialDone()).toBe(true);
  });
});
