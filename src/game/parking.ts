/**
 * Wildhaven — parking capacity & occupancy.
 *
 * All lots share one pool of visitor cars. Spaces nearest the entrance fill
 * first; more / better-maintained lots raise how many guests the park can hold.
 */

import type { Building, Vec2 } from "./types";

/** Visual stall grid per parking-lot building (matches the mesh). */
export const PARKING_STALLS_X = 6;
export const PARKING_STALLS_Z = 2;
export const PARKING_STALLS_PER_LOT = PARKING_STALLS_X * PARKING_STALLS_Z; // 12

/** Average guests represented by one parked car (families share rides). */
export const GUESTS_PER_CAR = 2.75;

/** Hard walk-up capacity when there is no usable parking. */
export const WALKUP_GUEST_CAP = 18;

/** Condition below this → lot is closed (no stalls, no arrivals credit). */
export const PARKING_CLOSED_CONDITION = 15;

export function listParkingLots(buildings: Record<string, Building>): Building[] {
  return Object.values(buildings).filter((b) => b.defId === "parking-lot");
}

/** Usable stall count for one lot (0 if closed / ruined). */
export function lotStallCapacity(lot: Building): number {
  if (lot.condition < PARKING_CLOSED_CONDITION) return 0;
  const cond = Math.max(0, Math.min(1, lot.condition / 100));
  // Below ~40% condition, some stalls are blocked off.
  const usableFrac = lot.condition < 40 ? cond * 0.85 : cond;
  return Math.max(0, Math.round(PARKING_STALLS_PER_LOT * usableFrac));
}

/** Total guest capacity from all lots (or walk-up trickle with none). */
export function parkingGuestCapacity(buildings: Record<string, Building>): number {
  const lots = listParkingLots(buildings);
  if (lots.length === 0) return WALKUP_GUEST_CAP;
  let stalls = 0;
  for (const lot of lots) stalls += lotStallCapacity(lot);
  if (stalls <= 0) return Math.min(WALKUP_GUEST_CAP, 10);
  return Math.round(stalls * GUESTS_PER_CAR);
}

/**
 * Soft multiplier kept for UI / legacy call sites.
 * 1.0 ≈ one healthy starter lot; scales up with total stall capacity.
 */
export function parkingArrivalFactor(buildings: Record<string, Building>): number {
  const capacity = parkingGuestCapacity(buildings);
  // One full lot ≈ 12 * 2.75 ≈ 33 guests → factor ~1.0
  const baseline = PARKING_STALLS_PER_LOT * GUESTS_PER_CAR;
  return Math.max(0.15, Math.min(2.2, capacity / baseline));
}

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/** Prefer the entrance arch; fall back to average lot position / origin. */
export function parkingEntranceAnchor(buildings: Record<string, Building>): Vec2 {
  const arch = Object.values(buildings).find((b) => b.defId === "entrance-arch");
  if (arch) return { x: arch.position.x, z: arch.position.z };
  const lots = listParkingLots(buildings);
  if (lots.length === 0) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (const lot of lots) {
    x += lot.position.x;
    z += lot.position.z;
  }
  return { x: x / lots.length, z: z / lots.length };
}

/**
 * How many cars sit in each lot for the current guest count.
 * Lots closer to the entrance fill completely before farther lots get cars.
 */
export function parkingLotCarCounts(
  buildings: Record<string, Building>,
  guestCount: number,
): Record<string, number> {
  const lots = listParkingLots(buildings);
  const result: Record<string, number> = {};
  for (const lot of lots) result[lot.instanceId] = 0;
  if (lots.length === 0 || guestCount <= 0) return result;

  const entrance = parkingEntranceAnchor(buildings);
  const ordered = [...lots].sort(
    (a, b) => dist2(a.position, entrance) - dist2(b.position, entrance),
  );

  let totalStalls = 0;
  for (const lot of ordered) totalStalls += lotStallCapacity(lot);
  if (totalStalls <= 0) return result;

  // Cars demanded by current occupancy, capped by total stalls.
  let carsLeft = Math.min(
    totalStalls,
    Math.max(0, Math.ceil(guestCount / GUESTS_PER_CAR)),
  );

  for (const lot of ordered) {
    const stalls = lotStallCapacity(lot);
    if (stalls <= 0 || carsLeft <= 0) {
      result[lot.instanceId] = 0;
      continue;
    }
    const take = Math.min(stalls, carsLeft);
    result[lot.instanceId] = take;
    carsLeft -= take;
  }

  return result;
}

export function parkingSummary(
  buildings: Record<string, Building>,
  guestCount = 0,
): {
  lots: number;
  avgCondition: number;
  factor: number;
  capacity: number;
  carsParked: number;
  stalls: number;
  label: string;
} {
  const lots = listParkingLots(buildings);
  const factor = parkingArrivalFactor(buildings);
  const capacity = parkingGuestCapacity(buildings);
  const cars = parkingLotCarCounts(buildings, guestCount);
  const carsParked = Object.values(cars).reduce((n, c) => n + c, 0);
  let stalls = 0;
  for (const lot of lots) stalls += lotStallCapacity(lot);

  if (lots.length === 0) {
    return {
      lots: 0,
      avgCondition: 0,
      factor,
      capacity,
      carsParked: 0,
      stalls: 0,
      label: "No parking — walk-up traffic only",
    };
  }

  const avgCondition = Math.round(
    lots.reduce((n, b) => n + b.condition, 0) / lots.length,
  );
  let label = "Parking open";
  if (avgCondition < PARKING_CLOSED_CONDITION) label = "Parking closed — needs repair";
  else if (avgCondition < 40) label = "Parking poor — capacity limited";
  else if (carsParked >= stalls && stalls > 0) label = "Lots full";
  else if (lots.length >= 2) label = "Plenty of parking";
  return { lots: lots.length, avgCondition, factor, capacity, carsParked, stalls, label };
}
