/**
 * Wildhaven — UI store (Zustand).
 *
 * Purely-presentation state that intentionally lives OUTSIDE the authoritative
 * game store (gameStore.ts, owned by the simulation and iterated on separately).
 * Keeping the HUD's own concerns here — which build tab is open, the finance
 * modal, and which derived toasts have been dismissed — means the UI is
 * insulated from churn in the simulation store's surface.
 */

import { create } from "zustand";

import { TUTORIAL_STEPS, isTutorialDone, markTutorialDone } from "../game/tutorial";

/** Bottom-toolbar tabs. "animals" is the adoption strip. */
export type BuildTab = "habitat" | "scenery" | "guest" | "staff" | "animals";

export type NotificationKind = "critical" | "warning" | "success" | "info";

export interface GameNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  /** When true, will not auto-dismiss (e.g. bankruptcy). */
  sticky?: boolean;
}

export interface UIStore {
  /** Which build tab (if any) is expanded. */
  activeTab: BuildTab | null;
  /** Finance modal visibility. */
  financeOpen: boolean;
  /** Keeper's Guide modal visibility. */
  guideOpen: boolean;
  /** Animal overview modal visibility. */
  animalsOpen: boolean;
  /** Jobs / staff roles overview modal visibility. */
  jobsOpen: boolean;
  /** Forced top-down land purchase survey. */
  landSelectOpen: boolean;
  /** First-run skippable tutorial. */
  tutorialOpen: boolean;
  tutorialStep: number;
  /** Ids of derived notifications the player has dismissed this session. */
  dismissed: string[];

  setActiveTab: (tab: BuildTab | null) => void;
  toggleFinance: () => void;
  openFinance: () => void;
  toggleGuide: () => void;
  toggleAnimals: () => void;
  toggleJobs: () => void;
  openLandSelect: () => void;
  closeLandSelect: () => void;
  /** Close finance / guide / animals / jobs / land survey (not tutorial). */
  closeOverlays: () => void;
  /** Offer the tutorial when the player has never finished/skipped it. */
  maybeOpenTutorial: () => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  skipTutorial: () => void;
  dismissNotification: (id: string) => void;
}

const closeModals = {
  financeOpen: false,
  guideOpen: false,
  animalsOpen: false,
  jobsOpen: false,
  landSelectOpen: false,
};

export const useUIStore = create<UIStore>((set, get) => ({
  activeTab: null,
  financeOpen: false,
  guideOpen: false,
  animalsOpen: false,
  jobsOpen: false,
  landSelectOpen: false,
  tutorialOpen: false,
  tutorialStep: 0,
  dismissed: [],

  setActiveTab: (tab) => set((s) => ({ activeTab: s.activeTab === tab ? null : tab })),
  toggleFinance: () =>
    set((s) => ({
      ...closeModals,
      financeOpen: !s.financeOpen,
      landSelectOpen: false,
    })),
  openFinance: () => set({ ...closeModals, financeOpen: true }),
  toggleGuide: () =>
    set((s) => ({ ...closeModals, guideOpen: !s.guideOpen })),
  toggleAnimals: () =>
    set((s) => ({ ...closeModals, animalsOpen: !s.animalsOpen })),
  toggleJobs: () =>
    set((s) => ({ ...closeModals, jobsOpen: !s.jobsOpen })),
  openLandSelect: () =>
    set({ ...closeModals, landSelectOpen: true, activeTab: null }),
  closeLandSelect: () => set({ landSelectOpen: false }),
  closeOverlays: () => set({ ...closeModals }),

  maybeOpenTutorial: () => {
    if (isTutorialDone()) return;
    set({ ...closeModals, tutorialOpen: true, tutorialStep: 0, activeTab: null });
  },
  nextTutorialStep: () => {
    const { tutorialStep } = get();
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      markTutorialDone();
      set({ tutorialOpen: false, tutorialStep: 0 });
      return;
    }
    set({ tutorialStep: tutorialStep + 1 });
  },
  prevTutorialStep: () =>
    set((s) => ({ tutorialStep: Math.max(0, s.tutorialStep - 1) })),
  skipTutorial: () => {
    markTutorialDone();
    set({ tutorialOpen: false, tutorialStep: 0 });
  },

  dismissNotification: (id) =>
    set((s) => (s.dismissed.includes(id) ? {} : { dismissed: [...s.dismissed, id] })),
}));
