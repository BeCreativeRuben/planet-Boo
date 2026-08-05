/**
 * Wildhaven — park sanitation (litter, bins, janitors).
 *
 * Guests drop trash as they walk. Nearby bins absorb it until full; overflow
 * becomes ground litter. Janitors empty bins and pick up piles.
 */

import type { Building, Litter, Staff, Vec2 } from "./types";

const clamp = (n: number, lo = 0, hi = 100): number =>
  Math.max(lo, Math.min(hi, n));

/** Chance per real second that a walking guest discards something. */
export const LITTER_DROP_RATE = 0.055;
/** How full a bin gets from one guest drop. */
export const BIN_FILL_PER_DROP = 7;
/** Max distance (m) to prefer a bin over ground litter. */
export const BIN_CATCH_RADIUS = 5.5;
/** Soft cap on concurrent ground piles (perf). */
export const MAX_LITTER = 80;
/** How much fill one janitor removes from a bin per pulse. */
export const JANITOR_EMPTY_AMOUNT = 38;
/** How many litter piles one janitor clears per pulse. */
export const JANITOR_PICK_SLOTS = 5;
/** Happiness penalty scale from mess (0..~25). */
export const MESS_HAPPINESS_PENALTY = 22;

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function listTrashBins(buildings: Record<string, Building>): Building[] {
  return Object.values(buildings).filter((b) => b.defId === "trash-bin");
}

/** Nearest bin within radius, or null. */
export function nearestBin(
  pos: Vec2,
  buildings: Record<string, Building>,
  radius = BIN_CATCH_RADIUS,
): Building | null {
  const r2 = radius * radius;
  let best: Building | null = null;
  let bestD = r2;
  for (const b of listTrashBins(buildings)) {
    const d = dist2(pos, b.position);
    if (d <= bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}

/**
 * Guest discards trash at `pos`. Prefers a nearby bin; otherwise spawns litter.
 * Returns updated buildings + litter map.
 */
export function disposeGuestTrash(
  pos: Vec2,
  buildings: Record<string, Building>,
  litter: Record<string, Litter>,
  nextId: () => string,
): { buildings: Record<string, Building>; litter: Record<string, Litter> } {
  const bin = nearestBin(pos, buildings);
  if (bin && (bin.fillLevel ?? 0) < 100) {
    const fill = clamp((bin.fillLevel ?? 0) + BIN_FILL_PER_DROP);
    return {
      buildings: { ...buildings, [bin.instanceId]: { ...bin, fillLevel: fill } },
      litter,
    };
  }

  // Overflow / no bin — pile on the ground (merge if very close).
  const nextLitter = { ...litter };
  for (const pile of Object.values(nextLitter)) {
    if (dist2(pos, pile.position) < 1.2) {
      nextLitter[pile.id] = {
        ...pile,
        amount: Math.min(5, pile.amount + 1),
      };
      return { buildings, litter: nextLitter };
    }
  }

  if (Object.keys(nextLitter).length >= MAX_LITTER) {
    // Cap reached — bump a random existing pile instead of allocating.
    const ids = Object.keys(nextLitter);
    const id = ids[Math.floor(Math.random() * ids.length)]!;
    const pile = nextLitter[id]!;
    nextLitter[id] = { ...pile, amount: Math.min(5, pile.amount + 1) };
    return { buildings, litter: nextLitter };
  }

  const id = nextId();
  nextLitter[id] = {
    id,
    position: {
      x: pos.x + (Math.random() - 0.5) * 0.6,
      z: pos.z + (Math.random() - 0.5) * 0.6,
    },
    amount: 1,
  };
  return { buildings, litter: nextLitter };
}

export interface SanitationResult {
  buildings: Record<string, Building>;
  litter: Record<string, Litter>;
  staff: Record<string, Staff>;
}

/**
 * Janitor pulse: empty fullest bins, pick up densest litter piles.
 * `mult` > 1 during night maintenance.
 */
export function applyJanitorPulse(
  buildings: Record<string, Building>,
  litter: Record<string, Litter>,
  staff: Record<string, Staff>,
  mult = 1,
): SanitationResult {
  const janitors = Object.values(staff).filter(
    (m) => m.role === "janitor" && m.energy > 8,
  );
  if (janitors.length === 0) {
    return { buildings, litter, staff };
  }

  let nextBuildings: Record<string, Building> = { ...buildings };
  let nextLitter: Record<string, Litter> = { ...litter };
  const nextStaff: Record<string, Staff> = { ...staff };

  for (const janitor of janitors) {
    let work = 0;

    // Empty fullest bins first.
    const bins = listTrashBins(nextBuildings)
      .filter((b) => (b.fillLevel ?? 0) > 5)
      .sort((a, b) => (b.fillLevel ?? 0) - (a.fillLevel ?? 0));

    for (const bin of bins.slice(0, 2)) {
      const emptied = JANITOR_EMPTY_AMOUNT * mult;
      const fill = clamp((bin.fillLevel ?? 0) - emptied);
      nextBuildings[bin.instanceId] = { ...bin, fillLevel: fill };
      work++;
    }

    // Pick up litter piles (dirtiest first).
    const piles = Object.values(nextLitter).sort((a, b) => b.amount - a.amount);
    const slots = Math.ceil(JANITOR_PICK_SLOTS * mult);
    for (const pile of piles.slice(0, slots)) {
      delete nextLitter[pile.id];
      work++;
    }

    nextStaff[janitor.id] = {
      ...janitor,
      energy: clamp(janitor.energy - 2 - work * 0.6),
    };
  }

  return { buildings: nextBuildings, litter: nextLitter, staff: nextStaff };
}

/** 0..100 park cleanliness (100 = spotless). */
export function parkCleanliness(
  buildings: Record<string, Building>,
  litter: Record<string, Litter>,
): number {
  const piles = Object.values(litter);
  const litterMess = piles.reduce((n, p) => n + p.amount, 0) * 4;
  const bins = listTrashBins(buildings);
  let binMess = 0;
  if (bins.length === 0) {
    binMess = 18;
  } else {
    const avgFill = bins.reduce((n, b) => n + (b.fillLevel ?? 0), 0) / bins.length;
    binMess = avgFill * 0.22;
    const overflowing = bins.filter((b) => (b.fillLevel ?? 0) >= 95).length;
    binMess += overflowing * 6;
  }
  return clamp(100 - litterMess - binMess);
}

/** How much mess subtracts from guest happiness target. */
export function messHappinessPenalty(
  buildings: Record<string, Building>,
  litter: Record<string, Litter>,
): number {
  const clean = parkCleanliness(buildings, litter);
  return ((100 - clean) / 100) * MESS_HAPPINESS_PENALTY;
}
