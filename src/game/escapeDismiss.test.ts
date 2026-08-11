import { describe, expect, it } from "vitest";

import { escapeDismissAction, type EscapeDismissContext } from "./escapeDismiss";

const base: EscapeDismissContext = {
  tutorialOpen: false,
  landSelectOpen: false,
  financeOpen: false,
  guideOpen: false,
  animalsOpen: false,
  jobsOpen: false,
  activeTab: null,
  buildActive: false,
  buildTool: "none",
  hasSelection: false,
  hasFocusAnimal: false,
};

describe("escapeDismissAction", () => {
  it("skips the tutorial first", () => {
    expect(escapeDismissAction({ ...base, tutorialOpen: true, landSelectOpen: true })).toBe(
      "tutorial",
    );
  });

  it("closes land survey first", () => {
    expect(escapeDismissAction({ ...base, landSelectOpen: true })).toBe("land-survey");
  });

  it("closes modals before build tools", () => {
    expect(
      escapeDismissAction({
        ...base,
        financeOpen: true,
        activeTab: "habitat",
        hasSelection: true,
      }),
    ).toBe("overlays");
  });

  it("closes build tab before clearing selection", () => {
    expect(
      escapeDismissAction({
        ...base,
        activeTab: "habitat",
        hasSelection: true,
      }),
    ).toBe("build");
  });

  it("clears selection when nothing else is open", () => {
    expect(escapeDismissAction({ ...base, hasSelection: true })).toBe("selection");
    expect(escapeDismissAction({ ...base, hasFocusAnimal: true })).toBe("selection");
  });

  it("does nothing when idle", () => {
    expect(escapeDismissAction(base)).toBe("none");
  });
});
