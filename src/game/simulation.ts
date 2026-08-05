/**
 * Wildhaven — pure simulation helpers.
 *
 * These functions are deliberately side-effect free (aside from a couple of
 * small module-level caches used purely to give animals/guests *smooth* motion
 * between frames — they hold no authoritative game state). The Zustand store
 * (see ../store/gameStore.ts) is the single source of truth; it calls these to
 * advance the world each frame.
 *
 * Coordinate model
 * ----------------
 * The world is a fixed MAX_MAP_SIZE grid centred on the origin. Players own a
 * smaller centred *plot* that can expand via land purchases without shifting
 * existing buildings. Grid cell `c` maps to world centre `c - HALF + 0.5`.
 */

import type {
  Animal,
  Biome,
  Bounds,
  Building,
  BuildingDef,
  Guest,
  Habitat,
  Vec2,
} from "./types";
import { getBuilding } from "./buildings";
import { isOwnedCell } from "./parcels";

/* -------------------------------------------------------------------------- */
/*  Grid / coordinate constants + helpers                                     */
/* -------------------------------------------------------------------------- */

/** Absolute world size in cells (never shrinks; expansions grow the owned plot). */
export const MAX_MAP_SIZE = 160;
/** @deprecated Prefer MAX_MAP_SIZE — kept for older imports. */
export const MAP_SIZE = MAX_MAP_SIZE;
/** Half the max map — the world origin sits at the park centre. */
export const HALF = MAX_MAP_SIZE / 2;

/** Starting owned plot edge length (centred in the max map). */
export const START_PLOT_SIZE = 80;
/** Metres/cells added to the plot edge per land purchase. */
export const PLOT_STEP = 20;
/** Hard cap for owned plot size. */
export const MAX_PLOT_SIZE = MAX_MAP_SIZE;

/** Cell offset where the owned plot begins for a given plot size. */
export function plotOffset(plotSize: number): number {
  return Math.floor((MAX_MAP_SIZE - plotSize) / 2);
}

/** Is a grid cell inside the absolute world? */
export function inWorld(c: number): boolean {
  return c >= 0 && c < MAX_MAP_SIZE;
}

/** Is a grid cell inside the player's owned plot? */
export function inPlot(c: number, plotSize: number): boolean {
  const o = plotOffset(plotSize);
  return c >= o && c < o + plotSize;
}

/**
 * @deprecated Prefer parcelPurchaseCost / listBuyableParcels — kept for any
 * leftover callers during the directional-plot migration.
 */
export function landExpansionCost(plotSize: number): number {
  if (plotSize >= MAX_PLOT_SIZE) return Number.POSITIVE_INFINITY;
  const tier = Math.max(0, Math.round((plotSize - START_PLOT_SIZE) / PLOT_STEP));
  return 15_000 + tier * 12_000;
}

/** World coordinate → grid cell index. */
export function worldToCell(w: number): number {
  return Math.floor(w + HALF);
}

/** Grid cell → world-space centre of that cell. */
export function cellCenter(cell: Vec2): Vec2 {
  return { x: cell.x - HALF + 0.5, z: cell.z - HALF + 0.5 };
}

/** Footprint dimensions for a def, respecting quarter-turn rotation. */
function footprintSize(def: BuildingDef | undefined, rotation: number): [number, number] {
  const w = Math.max(1, Math.round(def?.size[0] ?? 1));
  const d = Math.max(1, Math.round(def?.size[1] ?? 1));
  return rotation % 2 === 0 ? [w, d] : [d, w];
}

/** World-space centre of a building whose top-left cell is `cell`. */
export function footprintCenter(
  cell: Vec2,
  def: BuildingDef | undefined,
  rotation = 0,
): Vec2 {
  const [w, d] = footprintSize(def, rotation);
  return { x: cell.x - HALF + w / 2, z: cell.z - HALF + d / 2 };
}

/** Every grid cell covered by a placed building. */
export function footprintCells(building: Building): Vec2[] {
  const def = getBuilding(building.defId);
  const [w, d] = footprintSize(def, building.rotation);
  const startX = Math.round(building.position.x - w / 2 + HALF);
  const startZ = Math.round(building.position.z - d / 2 + HALF);
  const cells: Vec2[] = [];
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      cells.push({ x: startX + i, z: startZ + j });
    }
  }
  return cells;
}

const key = (x: number, z: number): string => `${x},${z}`;

/* -------------------------------------------------------------------------- */
/*  Climate defaults per biome                                                */
/* -------------------------------------------------------------------------- */

export const BIOME_CLIMATE: Record<Biome, { temperature: number; humidity: number }> = {
  savanna: { temperature: 29, humidity: 35 },
  forest: { temperature: 22, humidity: 68 },
  wetland: { temperature: 25, humidity: 75 },
  desert: { temperature: 34, humidity: 18 },
  arctic: { temperature: 2, humidity: 60 },
  mountain: { temperature: 8, humidity: 45 },
};

/* -------------------------------------------------------------------------- */
/*  Placement / enclosure geometry                                           */
/* -------------------------------------------------------------------------- */

/** All grid cells occupied by any placed building (for overlap tests). */
export function occupiedCells(buildings: Record<string, Building>): Set<string> {
  const set = new Set<string>();
  for (const b of Object.values(buildings)) {
    for (const c of footprintCells(b)) set.add(key(c.x, c.z));
  }
  return set;
}

/** Cells forming habitat walls (fences + gates). */
export function collectFenceCells(buildings: Record<string, Building>): Set<string> {
  const set = new Set<string>();
  for (const b of Object.values(buildings)) {
    if (b.defId === "fence-segment" || b.defId === "habitat-gate") {
      for (const c of footprintCells(b)) set.add(key(c.x, c.z));
    }
  }
  return set;
}

/**
 * Preferred fence/gate yaw from neighbouring wall cells.
 * Mesh is thin on local Z: 0 = east–west run, 1 = north–south run.
 */
export function fenceRotationFromNeighbors(
  cell: Vec2,
  fenceCells: Set<string>,
  fallback = 0,
): number {
  const ew =
    (fenceCells.has(key(cell.x + 1, cell.z)) ? 1 : 0) +
    (fenceCells.has(key(cell.x - 1, cell.z)) ? 1 : 0);
  const ns =
    (fenceCells.has(key(cell.x, cell.z + 1)) ? 1 : 0) +
    (fenceCells.has(key(cell.x, cell.z - 1)) ? 1 : 0);
  if (ew > ns) return 0;
  if (ns > ew) return 1;
  if (ew > 0) return 0;
  if (ns > 0) return 1;
  return fallback;
}

/** Stroke direction → fence rotation (0 = E–W, 1 = N–S). */
export function fenceRotationForStroke(from: Vec2, to: Vec2, fallback = 0): number {
  const dx = Math.abs(to.x - from.x);
  const dz = Math.abs(to.z - from.z);
  if (dx === 0 && dz === 0) return fallback;
  return dx >= dz ? 0 : 1;
}

/**
 * Snap fence/gate pieces onto cell centres and orient them along connected runs.
 * Fixes demo seeds and older saves that stored every segment at rotation 0.
 */
export function alignFenceBuildings(
  buildings: Record<string, Building>,
): Record<string, Building> {
  const fenceCells = collectFenceCells(buildings);
  let changed = false;
  const next: Record<string, Building> = { ...buildings };

  for (const b of Object.values(buildings)) {
    if (b.defId !== "fence-segment" && b.defId !== "habitat-gate") continue;
    const cells = footprintCells(b);
    if (cells.length === 0) continue;
    const cell = cells[0]!;
    const def = getBuilding(b.defId);
    const rotation = fenceRotationFromNeighbors(cell, fenceCells, b.rotation);
    const position = footprintCenter(cell, def, rotation);
    if (
      b.rotation === rotation &&
      Math.abs(b.position.x - position.x) < 1e-6 &&
      Math.abs(b.position.z - position.z) < 1e-6
    ) {
      continue;
    }
    next[b.instanceId] = { ...b, rotation, position };
    changed = true;
  }

  return changed ? next : buildings;
}

export interface Enclosure {
  cells: Set<string>;
  bounded: boolean;
  bounds: Bounds;
}

/**
 * Flood-fill outward from a seed cell, stopping at fence walls. If the fill
 * reaches the map edge the region is *unbounded* (the fence has a gap).
 */
export function floodFillEnclosure(seed: Vec2, fenceCells: Set<string>): Enclosure {
  const cells = new Set<string>();
  const queue: Vec2[] = [seed];
  let bounded = true;
  let minX = seed.x;
  let maxX = seed.x;
  let minZ = seed.z;
  let maxZ = seed.z;

  const seedKey = key(seed.x, seed.z);
  if (fenceCells.has(seedKey)) return { cells, bounded: false, bounds: emptyBounds() };
  cells.add(seedKey);

  const LIMIT = MAX_MAP_SIZE * MAX_MAP_SIZE;
  while (queue.length && cells.size < LIMIT) {
    const { x, z } = queue.pop()!;
    const neighbours = [
      { x: x + 1, z },
      { x: x - 1, z },
      { x, z: z + 1 },
      { x, z: z - 1 },
    ];
    for (const n of neighbours) {
      if (!inWorld(n.x) || !inWorld(n.z)) {
        bounded = false;
        continue;
      }
      const k = key(n.x, n.z);
      if (cells.has(k) || fenceCells.has(k)) continue;
      cells.add(k);
      queue.push(n);
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minZ = Math.min(minZ, n.z);
      maxZ = Math.max(maxZ, n.z);
    }
  }

  return {
    cells,
    bounded,
    bounds: {
      min: { x: minX - HALF, z: minZ - HALF },
      max: { x: maxX + 1 - HALF, z: maxZ + 1 - HALF },
    },
  };
}

function emptyBounds(): Bounds {
  return { min: { x: 0, z: 0 }, max: { x: 0, z: 0 } };
}

/** Can a building of `defId` be placed with its top-left at `cell`? */
export function canPlaceBuilding(
  buildings: Record<string, Building>,
  defId: string,
  cell: Vec2,
  rotation = 0,
  ownedParcels: readonly string[] = [],
): boolean {
  const def = getBuilding(defId);
  if (!def) return false;
  const [w, d] = footprintSize(def, rotation);
  const occupied = occupiedCells(buildings);
  const owned = ownedParcels.length ? ownedParcels : null;
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      const cx = cell.x + i;
      const cz = cell.z + j;
      if (owned) {
        if (!isOwnedCell(cx, cz, owned)) return false;
      } else if (!inWorld(cx) || !inWorld(cz)) {
        return false;
      }
      if (occupied.has(key(cx, cz))) return false;
    }
  }
  return true;
}

/**
 * Recompute each habitat's derived fields (area, enrichment provided, member
 * buildings) from the current set of buildings. Returns a fresh habitats map.
 */
export function updateHabitatsFromBuildings(
  habitats: Record<string, Habitat>,
  buildings: Record<string, Building>,
): Record<string, Habitat> {
  const next: Record<string, Habitat> = {};
  for (const [id, h] of Object.entries(habitats)) {
    const enrichment = new Set(h.enrichmentProvided);
    const buildingIds: string[] = [];
    for (const b of Object.values(buildings)) {
      const inside =
        b.position.x >= h.bounds.min.x &&
        b.position.x <= h.bounds.max.x &&
        b.position.z >= h.bounds.min.z &&
        b.position.z <= h.bounds.max.z;
      if (!inside) continue;
      buildingIds.push(b.instanceId);
      const tag = getBuilding(b.defId)?.enrichment;
      if (tag) enrichment.add(tag);
    }
    const w = h.bounds.max.x - h.bounds.min.x;
    const d = h.bounds.max.z - h.bounds.min.z;
    next[id] = {
      ...h,
      area: Math.max(h.area, Math.round(w * d)),
      enrichmentProvided: [...enrichment],
      buildingIds,
    };
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/*  Deterministic hashing / palettes                                          */
/* -------------------------------------------------------------------------- */

/** Deterministic 0..1 value from a string id (stable across frames). */
export function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const SHIRT_COLORS = [
  "#c65b3c",
  "#3d7fa6",
  "#4f9142",
  "#c9a227",
  "#8e5aa6",
  "#d17a9a",
  "#4a5a6a",
  "#d99a3d",
];

/** A stable clothing colour for a guest. */
export function guestColor(id: string): string {
  return SHIRT_COLORS[Math.floor(hash01(id) * SHIRT_COLORS.length) % SHIRT_COLORS.length];
}

/* -------------------------------------------------------------------------- */
/*  Per-entity motion caches                                                  */
/* -------------------------------------------------------------------------- */

interface Motion {
  heading: number;
  timer: number;
}

const animalMotion = new Map<string, Motion>();

/** Current facing (radians) for an animal, for the render layer. */
export function getAnimalHeading(id: string): number {
  return animalMotion.get(id)?.heading ?? 0;
}

/** Drop cached motion for an entity (call when it is removed). */
export function forgetEntity(id: string): void {
  animalMotion.delete(id);
}

const clampTo = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * Advance an animal one frame: a gentle random-walk kept inside its habitat.
 * Returns the new world position and updates the heading cache.
 */
export function wanderAnimal(animal: Animal, habitat: Habitat | undefined, dt: number): Vec2 {
  let m = animalMotion.get(animal.id);
  if (!m) {
    m = { heading: hash01(animal.id) * Math.PI * 2, timer: 0 };
    animalMotion.set(animal.id, m);
  }

  m.timer -= dt;
  if (m.timer <= 0) {
    // Pick a fresh heading and hold it for a couple of seconds.
    m.heading += (Math.random() - 0.5) * Math.PI;
    m.timer = 1.5 + Math.random() * 2.5;
  }

  const speed = 0.7; // metres / second
  let nx = animal.position.x + Math.cos(m.heading) * speed * dt;
  let nz = animal.position.z + Math.sin(m.heading) * speed * dt;

  if (habitat) {
    // Stay clearly inside the fence line (bounds already exclude fence cells).
    const pad = 0.85;
    const { min, max } = habitat.bounds;
    if (nx < min.x + pad || nx > max.x - pad) {
      m.heading = Math.PI - m.heading;
      nx = clampTo(nx, min.x + pad, max.x - pad);
    }
    if (nz < min.z + pad || nz > max.z - pad) {
      m.heading = -m.heading;
      nz = clampTo(nz, min.z + pad, max.z - pad);
    }
  }

  return { x: nx, z: nz };
}

/* -------------------------------------------------------------------------- */
/*  Guests                                                                    */
/* -------------------------------------------------------------------------- */

/** Spawn a guest at (or near) the given position. */
export function spawnGuest(id: string, index: number, pos: Vec2): Guest {
  const jitter = (index % 5) * 0.15;
  return {
    id,
    position: { x: pos.x + jitter, z: pos.z },
    target: null,
    happiness: 70,
    wallet: 20 + Math.random() * 40,
    patience: 60 + Math.random() * 60,
    groupId: id,
    kind: "adult",
    leader: true,
    facing: Math.PI,
    activity: "walk",
    viewTimer: 0,
  };
}

const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

/** Is a world point inside a half-open AABB? */
export function pointInBounds(p: Vec2, b: Bounds, pad = 0): boolean {
  return (
    p.x >= b.min.x + pad &&
    p.x < b.max.x - pad &&
    p.z >= b.min.z + pad &&
    p.z < b.max.z - pad
  );
}

export function pointInAnyBounds(p: Vec2, boxes: Bounds[], pad = 0): boolean {
  for (const b of boxes) {
    if (pointInBounds(p, b, pad)) return true;
  }
  return false;
}

/** Grow an AABB outward by `pad` metres on every side. */
export function expandBounds(b: Bounds, pad: number): Bounds {
  return {
    min: { x: b.min.x - pad, z: b.min.z - pad },
    max: { x: b.max.x + pad, z: b.max.z + pad },
  };
}

/**
 * How far past the habitat interior guests must stay. Interior bounds stop at
 * the inner fence edge; ~1.05m covers the fence cell so visitors can't perch
 * on the timber.
 */
export const GUEST_FENCE_CLEARANCE = 1.05;

/** True when the world point sits on a fence or gate cell. */
export function pointOnFence(p: Vec2, fenceCells: Set<string>): boolean {
  return fenceCells.has(`${worldToCell(p.x)},${worldToCell(p.z)}`);
}

/** Can a guest stand / walk at this world point? */
export function guestWalkable(
  p: Vec2,
  blocked: Bounds[],
  fenceCells: Set<string>,
): boolean {
  if (fenceCells.size && pointOnFence(p, fenceCells)) return false;
  if (blocked.length && pointInAnyBounds(p, blocked)) return false;
  return true;
}

/** Nudge a guest off fences / out of enclosures onto nearby open ground. */
export function pushGuestClear(
  p: Vec2,
  blocked: Bounds[],
  fenceCells: Set<string>,
): Vec2 {
  if (guestWalkable(p, blocked, fenceCells)) return p;
  for (const r of [0.55, 1.1, 1.8, 2.6, 3.5]) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const candidate = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
      if (guestWalkable(candidate, blocked, fenceCells)) return candidate;
    }
  }
  // Last resort: drift toward park centre.
  return { x: p.x * 0.9, z: p.z * 0.9 };
}

/**
 * Snap each habitat's bounds to the closed fence ring around its centre.
 * Fixes older saves / demo parks whose AABB overran the timber walls.
 */
export function realignHabitatsToFences(
  habitats: Record<string, Habitat>,
  buildings: Record<string, Building>,
): Record<string, Habitat> {
  const fenceCells = collectFenceCells(buildings);
  if (fenceCells.size === 0) return habitats;

  let changed = false;
  const next: Record<string, Habitat> = { ...habitats };
  for (const [id, h] of Object.entries(habitats)) {
    const cx = (h.bounds.min.x + h.bounds.max.x) / 2;
    const cz = (h.bounds.min.z + h.bounds.max.z) / 2;
    let seed = { x: worldToCell(cx), z: worldToCell(cz) };
    // If the centre landed on a fence post, step toward park origin.
    if (fenceCells.has(`${seed.x},${seed.z}`)) {
      seed = {
        x: seed.x + (cx >= 0 ? -1 : 1),
        z: seed.z + (cz >= 0 ? -1 : 1),
      };
    }
    const enclosure = floodFillEnclosure(seed, fenceCells);
    if (!enclosure.bounded || enclosure.cells.size < 4) continue;
    const w = enclosure.bounds.max.x - enclosure.bounds.min.x;
    const d = enclosure.bounds.max.z - enclosure.bounds.min.z;
    next[id] = {
      ...h,
      bounds: enclosure.bounds,
      area: Math.max(1, Math.round(w * d)),
      fenced: true,
    };
    changed = true;
  }
  return changed ? next : habitats;
}

/**
 * Advance a guest one frame along the park's paths. Returns a new guest with an
 * updated position, target and patience. Happiness / spending are the store's
 * job; this only handles movement.
 *
 * `blocked` habitat AABBs (usually expanded by {@link GUEST_FENCE_CLEARANCE})
 * and `fenceCells` are off-limits — guests won't pick waypoints on them or
 * walk through / perch on fence timber.
 */
export function stepGuest(
  guest: Guest,
  waypoints: Vec2[],
  dt: number,
  blocked: Bounds[] = [],
  fenceCells: Set<string> = EMPTY_FENCE_CELLS,
): Guest {
  const walkable = (p: Vec2) => guestWalkable(p, blocked, fenceCells);
  const openWaypoints =
    blocked.length || fenceCells.size ? waypoints.filter(walkable) : waypoints;

  let target = guest.target;
  if (target && !walkable(target)) target = null;

  const reached = target ? dist2(guest.position, target) < 1.2 : true;
  if ((!target || reached) && openWaypoints.length) {
    target = openWaypoints[Math.floor(Math.random() * openWaypoints.length)]!;
  }

  let position = guest.position;
  if (target) {
    const dx = target.x - guest.position.x;
    const dz = target.z - guest.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const speed = 1.4; // metres / second
    const step = speed * dt;
    const nextPos = {
      x: guest.position.x + (dx / len) * step,
      z: guest.position.z + (dz / len) * step,
    };
    // Mid-step sample catches thin fence crossings between cells.
    const mid = {
      x: guest.position.x + (dx / len) * step * 0.5,
      z: guest.position.z + (dz / len) * step * 0.5,
    };
    if (walkable(mid) && walkable(nextPos)) {
      position = nextPos;
    } else {
      // Hit an enclosure / fence — abandon this target and slide along the edge.
      target = null;
      const slide = { x: guest.position.x + (dx / len) * 0.25, z: guest.position.z };
      if (walkable(slide)) position = slide;
      else {
        const slideZ = { x: guest.position.x, z: guest.position.z + (dz / len) * 0.25 };
        if (walkable(slideZ)) position = slideZ;
      }
    }
  }

  // If somehow already on a fence or inside (old save / bad spawn), clear them.
  if (!walkable(position)) {
    position = pushGuestClear(position, blocked, fenceCells);
  }

  return { ...guest, position, target, patience: guest.patience - dt };
}

const EMPTY_FENCE_CELLS: Set<string> = new Set();
