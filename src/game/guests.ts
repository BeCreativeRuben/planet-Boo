/**
 * Wildhaven — guest parties and park-looking behaviour.
 *
 * Guests arrive as solo visitors or small families, stroll at a calm pace,
 * and stop outside habitats to watch animals instead of teleporting between
 * random waypoints.
 */

import type { Bounds, Building, Guest, Habitat, Vec2 } from "./types";
import {
  GUEST_FENCE_CLEARANCE,
  expandBounds,
  guestWalkable,
  pushGuestClear,
} from "./simulation";

const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

const yawToward = (from: Vec2, to: Vec2): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

/** How long a typical viewing stop lasts (seconds). */
const VIEW_MIN = 5;
const VIEW_MAX = 14;

export interface GuestSpawnOpts {
  id: string;
  groupId: string;
  kind: Guest["kind"];
  leader: boolean;
  position: Vec2;
  index: number;
}

export function createGuest(opts: GuestSpawnOpts): Guest {
  const jitter = (opts.index % 5) * 0.12;
  return {
    id: opts.id,
    position: {
      x: opts.position.x + jitter + (opts.leader ? 0 : (Math.random() - 0.5) * 0.8),
      z: opts.position.z + (opts.leader ? 0 : (Math.random() - 0.5) * 0.8),
    },
    target: null,
    happiness: 68 + Math.random() * 12,
    wallet: opts.kind === "child" ? 8 + Math.random() * 16 : 22 + Math.random() * 40,
    patience: 70 + Math.random() * 70,
    groupId: opts.groupId,
    kind: opts.kind,
    leader: opts.leader,
    facing: Math.PI, // face into the park from the south entrance by default
    activity: "walk",
    viewTimer: 0,
  };
}

/**
 * Spawn a party of 1–5 guests (solo, couple, or family with kids).
 * Returns members; caller assigns ids via `nextId`.
 */
export function spawnGuestParty(
  entrance: Vec2,
  nextId: () => string,
  startIndex: number,
): Guest[] {
  const roll = Math.random();
  let adults = 1;
  let children = 0;
  if (roll < 0.22) {
    // Solo
    adults = 1;
  } else if (roll < 0.48) {
    // Couple / friends
    adults = 2;
  } else if (roll < 0.78) {
    // Family
    adults = 2;
    children = 1 + Math.floor(Math.random() * 2);
  } else {
    // Larger family / group
    adults = 2 + Math.floor(Math.random() * 2);
    children = Math.floor(Math.random() * 3);
  }

  const groupId = nextId();
  const party: Guest[] = [];
  let idx = startIndex;
  for (let i = 0; i < adults; i++) {
    party.push(
      createGuest({
        id: nextId(),
        groupId,
        kind: "adult",
        leader: i === 0,
        position: entrance,
        index: idx++,
      }),
    );
  }
  for (let i = 0; i < children; i++) {
    party.push(
      createGuest({
        id: nextId(),
        groupId,
        kind: "child",
        leader: false,
        position: entrance,
        index: idx++,
      }),
    );
  }
  return party;
}

/** Normalize older saves that lack party / viewing fields. */
export function migrateGuest(g: Guest, fallbackGroupId: string): Guest {
  return {
    ...g,
    groupId: g.groupId ?? fallbackGroupId,
    kind: g.kind ?? "adult",
    leader: g.leader ?? true,
    facing: g.facing ?? 0,
    activity: g.activity ?? "walk",
    viewTimer: g.viewTimer ?? 0,
    viewHabitatId: g.viewHabitatId,
  };
}

export interface Viewpoint {
  position: Vec2;
  habitatId: string;
  /** Prefer galleries / good angles. */
  weight: number;
}

/**
 * Build lookout spots just outside habitat fences (and at viewing galleries).
 * Guests walk here, then stop to watch animals.
 */
export function buildViewpoints(
  habitats: Record<string, Habitat>,
  buildings: Record<string, Building>,
  fenceCells: Set<string>,
): Viewpoint[] {
  const blocked = Object.values(habitats).map((h) =>
    expandBounds(h.bounds, GUEST_FENCE_CLEARANCE),
  );
  const views: Viewpoint[] = [];

  for (const h of Object.values(habitats)) {
    if (h.animalIds.length === 0) continue;
    const { min, max } = h.bounds;
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;
    // Ring of points outside each side of the enclosure.
    const ring: Vec2[] = [
      { x: cx, z: min.z - 1.6 },
      { x: cx, z: max.z + 1.6 },
      { x: min.x - 1.6, z: cz },
      { x: max.x + 1.6, z: cz },
      { x: min.x - 1.2, z: min.z - 1.2 },
      { x: max.x + 1.2, z: min.z - 1.2 },
      { x: min.x - 1.2, z: max.z + 1.2 },
      { x: max.x + 1.2, z: max.z + 1.2 },
    ];
    for (const p of ring) {
      if (!guestWalkable(p, blocked, fenceCells)) continue;
      views.push({ position: p, habitatId: h.id, weight: 1 });
    }
  }

  for (const b of Object.values(buildings)) {
    if (b.defId !== "viewing-gallery") continue;
    // Find nearest habitat with animals.
    let bestId: string | undefined;
    let bestD = Infinity;
    for (const h of Object.values(habitats)) {
      if (h.animalIds.length === 0) continue;
      const cx = (h.bounds.min.x + h.bounds.max.x) / 2;
      const cz = (h.bounds.min.z + h.bounds.max.z) / 2;
      const d = dist2(b.position, { x: cx, z: cz });
      if (d < bestD) {
        bestD = d;
        bestId = h.id;
      }
    }
    if (!bestId) continue;
    const p = { x: b.position.x, z: b.position.z };
    if (!guestWalkable(p, blocked, fenceCells)) continue;
    views.push({ position: p, habitatId: bestId, weight: 3.5 });
  }

  return views;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T | null {
  if (items.length === 0) return null;
  let total = 0;
  for (const it of items) total += it.weight;
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}

function habitatCenter(h: Habitat): Vec2 {
  return {
    x: (h.bounds.min.x + h.bounds.max.x) / 2,
    z: (h.bounds.min.z + h.bounds.max.z) / 2,
  };
}

function followOffset(member: Guest): Vec2 {
  // Stable-ish offset from leader so families cluster without stacking.
  const h = Math.abs(hashStr(member.id));
  const ang = (h % 360) * (Math.PI / 180);
  const radius = member.kind === "child" ? 0.55 + (h % 40) / 100 : 0.85 + (h % 50) / 80;
  return { x: Math.cos(ang) * radius, z: Math.sin(ang) * radius };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export interface StepGuestContext {
  waypoints: Vec2[];
  viewpoints: Viewpoint[];
  habitats: Record<string, Habitat>;
  blocked: Bounds[];
  fenceCells: Set<string>;
  /** Other guests (for finding the group leader). */
  guests: Record<string, Guest>;
  dt: number;
}

/**
 * Advance one guest: leaders pick habitat lookouts / amenities; followers
 * trail the leader; both pause to watch animals when they arrive.
 */
export function stepGuestBehavior(guest: Guest, ctx: StepGuestContext): Guest {
  const { dt, blocked, fenceCells, waypoints, viewpoints, habitats, guests } = ctx;
  const walkable = (p: Vec2) => guestWalkable(p, blocked, fenceCells);

  let next: Guest = { ...guest };
  const speed = guest.kind === "child" ? 0.72 : 0.9;

  // --- Viewing: stand still, face the animals, enjoy the park -------------
  if (next.activity === "view" && next.viewTimer > 0) {
    next.viewTimer = Math.max(0, next.viewTimer - dt);
    const habitat = next.viewHabitatId ? habitats[next.viewHabitatId] : undefined;
    if (habitat) {
      const center = habitatCenter(habitat);
      next.facing = yawToward(next.position, center);
      // Watching animals is the highlight — happiness drifts up, patience slower.
      next.happiness = Math.min(100, next.happiness + 3.5 * dt);
      next.patience = next.patience - dt * 0.35;
    } else {
      next.patience = next.patience - dt * 0.5;
    }
    if (next.viewTimer <= 0) {
      next.activity = "walk";
      next.viewHabitatId = undefined;
      next.target = null;
    }
    return next;
  }

  // --- Followers trail their group leader ---------------------------------
  if (!next.leader) {
    const leader = Object.values(guests).find(
      (g) => g.groupId === next.groupId && g.leader && g.id !== next.id,
    );
    if (leader) {
      // Match leader's viewing — gather at the lookout.
      if (leader.activity === "view" && leader.viewHabitatId) {
        const offset = followOffset(next);
        const gather = {
          x: leader.position.x + offset.x * 0.4,
          z: leader.position.z + offset.z * 0.4,
        };
        if (dist2(next.position, gather) < 0.9) {
          next.activity = "view";
          next.viewTimer = Math.max(2, leader.viewTimer);
          next.viewHabitatId = leader.viewHabitatId;
          next.target = null;
          const habitat = habitats[leader.viewHabitatId];
          if (habitat) next.facing = yawToward(next.position, habitatCenter(habitat));
          next.patience = next.patience - dt * 0.35;
          next.happiness = Math.min(100, next.happiness + 3.2 * dt);
          return next;
        }
        next.target = gather;
      } else {
        const offset = followOffset(next);
        next.target = {
          x: leader.position.x + offset.x,
          z: leader.position.z + offset.z,
        };
        // Softly adopt leader's destination bias when far behind.
        if (leader.target && dist2(next.position, leader.position) > 4) {
          next.target = {
            x: leader.target.x + offset.x * 0.5,
            z: leader.target.z + offset.z * 0.5,
          };
        }
      }
    }
  }

  // --- Leaders (and solo guests) pick the next destination ----------------
  if (next.leader) {
    const reached = next.target ? dist2(next.position, next.target) < 1.0 : true;
    if (reached) {
      // Arrived — maybe start viewing if this was a habitat lookout.
      if (next.viewHabitatId && habitats[next.viewHabitatId]) {
        next.activity = "view";
        next.viewTimer = VIEW_MIN + Math.random() * (VIEW_MAX - VIEW_MIN);
        next.target = null;
        next.facing = yawToward(next.position, habitatCenter(habitats[next.viewHabitatId]!));
        return next;
      }

      // Choose next goal: prefer watching animals.
      const roll = Math.random();
      const openViews = viewpoints.filter((v) => walkable(v.position));
      const openWays = waypoints.filter(walkable);

      if (roll < 0.72 && openViews.length > 0) {
        // Bias toward nearby habitats so groups don't teleport across the map.
        const scored = openViews.map((v) => {
          const d = Math.sqrt(dist2(next.position, v.position));
          const nearBoost = d < 18 ? 2.2 : d < 35 ? 1.2 : 0.55;
          return { ...v, weight: v.weight * nearBoost };
        });
        const pick = pickWeighted(scored);
        if (pick) {
          next.target = pick.position;
          next.viewHabitatId = pick.habitatId;
        }
      } else if (openWays.length > 0) {
        // Amenity / path stroll — clear view intent.
        next.viewHabitatId = undefined;
        // Prefer closer waypoints for calmer motion.
        const near = openWays
          .map((p) => ({ p, d: dist2(next.position, p) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, Math.min(8, openWays.length));
        const choice = near[Math.floor(Math.random() * near.length)]!;
        next.target = choice.p;
      }
    }
  }

  // --- Walk toward target -------------------------------------------------
  if (next.target && walkable(next.target)) {
    const dx = next.target.x - next.position.x;
    const dz = next.target.z - next.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const step = speed * dt;
    if (len > 0.05) next.facing = yawToward(next.position, next.target);

    const nextPos = {
      x: next.position.x + (dx / len) * step,
      z: next.position.z + (dz / len) * step,
    };
    const mid = {
      x: next.position.x + (dx / len) * step * 0.5,
      z: next.position.z + (dz / len) * step * 0.5,
    };
    if (walkable(mid) && walkable(nextPos)) {
      next.position = nextPos;
    } else {
      next.target = null;
      next.viewHabitatId = undefined;
      const slide = { x: next.position.x + (dx / len) * 0.2, z: next.position.z };
      if (walkable(slide)) next.position = slide;
      else {
        const slideZ = { x: next.position.x, z: next.position.z + (dz / len) * 0.2 };
        if (walkable(slideZ)) next.position = slideZ;
      }
    }
  } else if (next.target && !walkable(next.target)) {
    next.target = null;
    next.viewHabitatId = undefined;
  }

  if (!walkable(next.position)) {
    next.position = pushGuestClear(next.position, blocked, fenceCells);
  }

  next.patience = next.patience - dt;
  return next;
}
