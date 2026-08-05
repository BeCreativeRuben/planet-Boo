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
  /** Ids of derived notifications the player has dismissed this session. */
  dismissed: string[];

  setActiveTab: (tab: BuildTab | null) => void;
  toggleFinance: () => void;
  toggleGuide: () => void;
  toggleAnimals: () => void;
  dismissNotification: (id: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: null,
  financeOpen: false,
  guideOpen: false,
  animalsOpen: false,
  dismissed: [],

  setActiveTab: (tab) => set((s) => ({ activeTab: s.activeTab === tab ? null : tab })),
  toggleFinance: () =>
    set((s) => ({ financeOpen: !s.financeOpen, guideOpen: false, animalsOpen: false })),
  toggleGuide: () =>
    set((s) => ({ guideOpen: !s.guideOpen, financeOpen: false, animalsOpen: false })),
  toggleAnimals: () =>
    set((s) => ({ animalsOpen: !s.animalsOpen, financeOpen: false, guideOpen: false })),
  dismissNotification: (id) =>
    set((s) => (s.dismissed.includes(id) ? {} : { dismissed: [...s.dismissed, id] })),
}));
