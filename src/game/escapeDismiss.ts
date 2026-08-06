/**
 * Wildhaven — Escape key dismiss priority.
 *
 * Pure logic shared by the HUD hook and unit tests.
 */

export type EscapeDismissAction =
  | "land-survey"
  | "overlays"
  | "build"
  | "selection"
  | "none";

export interface EscapeDismissContext {
  landSelectOpen: boolean;
  financeOpen: boolean;
  guideOpen: boolean;
  animalsOpen: boolean;
  jobsOpen: boolean;
  activeTab: string | null;
  buildActive: boolean;
  buildTool: string;
  hasSelection: boolean;
  hasFocusAnimal: boolean;
}

/** What Escape should dismiss first for the current UI state. */
export function escapeDismissAction(ctx: EscapeDismissContext): EscapeDismissAction {
  if (ctx.landSelectOpen) return "land-survey";
  if (ctx.financeOpen || ctx.guideOpen || ctx.animalsOpen || ctx.jobsOpen) {
    return "overlays";
  }
  if (ctx.activeTab || ctx.buildActive || ctx.buildTool !== "none") return "build";
  if (ctx.hasSelection || ctx.hasFocusAnimal) return "selection";
  return "none";
}
