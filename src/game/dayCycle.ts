/** Day/night park hours. One full day+night cycle ≈ 15 real minutes at 1×. */

export const DAY_LENGTH_SECONDS = 15 * 60

export type DayPhase = "dawn" | "day" | "dusk" | "night"

/**
 * `timeOfDay` is 0→1 over a full cycle. Lighting uses sin(π·t), so t≈0 and t≈1
 * are night and t≈0.5 is midday — phases follow that curve.
 */
export function getDayPhase(t: number): DayPhase {
  const x = ((t % 1) + 1) % 1
  if (x < 0.1 || x >= 0.82) return "night"
  if (x < 0.2) return "dawn"
  if (x < 0.7) return "day"
  return "dusk"
}

export function isNightPhase(phase: DayPhase): boolean {
  return phase === "night"
}

/**
 * Guests arrive during park hours, peak mid-day, taper at dusk, none at night.
 * Values are multipliers on the base spawn rate.
 */
export function guestArrivalFactor(t: number): number {
  const x = ((t % 1) + 1) % 1
  if (x < 0.1 || x >= 0.82) return 0
  if (x < 0.16) return 0.25
  if (x < 0.22) return 0.65
  if (x < 0.68) return 1
  if (x < 0.78) return 0.4
  return 0.1
}

/**
 * How quickly guests leave. Higher at dusk/night so the park clears for maintenance.
 */
export function guestLeaveFactor(t: number): number {
  const x = ((t % 1) + 1) % 1
  if (x < 0.1 || x >= 0.82) return 5.5
  if (x >= 0.7) return 2.4
  return 1
}

export function phaseLabel(phase: DayPhase): string {
  switch (phase) {
    case "dawn":
      return "Dawn"
    case "day":
      return "Day"
    case "dusk":
      return "Dusk"
    case "night":
      return "Night"
  }
}

export function phaseHint(phase: DayPhase): string {
  switch (phase) {
    case "dawn":
      return "Gates opening — early visitors trickle in"
    case "day":
      return "Park open — guests exploring"
    case "dusk":
      return "Closing soon — guests heading home"
    case "night":
      return "Closed — maintenance & building. Speed up to skip."
  }
}

/** Fraction of the food bar lost over one full day if nobody feeds. */
export const HUNGER_DRAIN_PER_DAY = 0.55

/** Night maintenance: keepers/vets/mechanics work faster while guests are gone. */
export const NIGHT_CARE_MULT = 1.85
export const NIGHT_REPAIR_MULT = 2.2
