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
  dismissNotification: (id: string) => void;
}

const closeModals = {
  financeOpen: false,
  guideOpen: false,
  animalsOpen: false,
  jobsOpen: false,
  landSelectOpen: false,
};

export const useUIStore = create<UIStore>((set) => ({
  activeTab: null,
  financeOpen: false,
  guideOpen: false,
  animalsOpen: false,
  jobsOpen: false,
  landSelectOpen: false,
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
  dismissNotification: (id) =>
    set((s) => (s.dismissed.includes(id) ? {} : { dismissed: [...s.dismissed, id] })),
}));
