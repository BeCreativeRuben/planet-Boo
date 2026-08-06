/**
 * Wildhaven — first-run tutorial helpers.
 *
 * Tracks whether the player has finished or skipped the onboarding tips so
 * new empty parks can show them once without nagging returns.
 */

export const TUTORIAL_DONE_KEY = "wildhaven-tutorial-done";

/** In-memory fallback when localStorage is missing (tests / private mode). */
let memoryDone = false;

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** Optional HUD hint (tab / control to look for). */
  hint?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Your park is empty — on purpose",
    body: "You start with an entrance, parking, and a path stub. Everything else is yours to build. Pause anytime with ⏸ if you need a breath.",
    hint: "This tour is optional — Skip whenever you like.",
  },
  {
    id: "habitat",
    title: "Fence a home",
    body: "Open Habitat, pick a biome, then draw a closed fence loop. Drop a gate on one side. When the ring closes it auto-claims — or use Claim habitat and click inside.",
    hint: "Bottom bar → Habitat",
  },
  {
    id: "animals",
    title: "Bring in animals",
    body: "Open Animals, pick a species that matches the habitat biome, then click inside the enclosure to place them. Wrong biome? They will never thrive.",
    hint: "Bottom bar → Animals",
  },
  {
    id: "staff",
    title: "Hire keepers before they starve",
    body: "Animals do not feed themselves. Hire a Zookeeper from the Staff tab as soon as you have residents. Add a cleaner and a vet as the park grows.",
    hint: "Bottom bar → Staff",
  },
  {
    id: "guests",
    title: "Guests pay the bills",
    body: "Extend paths from the entrance, add shops and viewing spots, and keep welfare high so appeal climbs. Click Balance for finances, or ? for the full Keeper's Guide.",
    hint: "Esc backs out of tools and panels",
  },
];

export function isTutorialDone(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
    }
  } catch {
    /* private mode / blocked storage */
  }
  return memoryDone;
}

export function markTutorialDone(): void {
  memoryDone = true;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TUTORIAL_DONE_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

/** Test helper. */
export function resetTutorialDone(): void {
  memoryDone = false;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(TUTORIAL_DONE_KEY);
    }
  } catch {
    /* ignore */
  }
}
