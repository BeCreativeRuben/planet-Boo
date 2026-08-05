/**
 * Wildhaven — buyable land parcels.
 *
 * The world is a fixed MAX_MAP_SIZE grid divided into PARCEL_SIZE squares.
 * Players start with a centred block and expand by purchasing any parcel that
 * shares an edge with owned land (choose direction / plot freely).
 */

import { HALF, MAX_MAP_SIZE, START_PLOT_SIZE, plotOffset } from "./simulation";
import type { Bounds, Vec2 } from "./types";

export const PARCEL_SIZE = 20;
export const PARCELS_AXIS = MAX_MAP_SIZE / PARCEL_SIZE; // 8

export function parcelKey(px: number, pz: number): string {
  return `${px},${pz}`;
}

export function parseParcelKey(key: string): { px: number; pz: number } {
  const [a, b] = key.split(",");
  return { px: Number(a), pz: Number(b) };
}

export function cellToParcel(cx: number, cz: number): { px: number; pz: number } {
  return {
    px: Math.floor(cx / PARCEL_SIZE),
    pz: Math.floor(cz / PARCEL_SIZE),
  };
}

export function parcelCellOrigin(px: number, pz: number): Vec2 {
  return { x: px * PARCEL_SIZE, z: pz * PARCEL_SIZE };
}

/** World-space centre of a parcel. */
export function parcelWorldCenter(px: number, pz: number): Vec2 {
  return {
    x: px * PARCEL_SIZE - HALF + PARCEL_SIZE / 2,
    z: pz * PARCEL_SIZE - HALF + PARCEL_SIZE / 2,
  };
}

/** World-space AABB of a parcel (cell edges). */
export function parcelWorldBounds(px: number, pz: number): Bounds {
  const minX = px * PARCEL_SIZE - HALF;
  const minZ = pz * PARCEL_SIZE - HALF;
  return {
    min: { x: minX, z: minZ },
    max: { x: minX + PARCEL_SIZE, z: minZ + PARCEL_SIZE },
  };
}

export function ownedParcelSet(owned: readonly string[]): Set<string> {
  return new Set(owned);
}

/** Starter park: centred 80×80 → parcels (2..5, 2..5). */
export function createStarterParcels(): string[] {
  const keys: string[] = [];
  // Cells [40,120) → parcels 2,3,4,5 on both axes.
  for (let px = 2; px <= 5; px++) {
    for (let pz = 2; pz <= 5; pz++) {
      keys.push(parcelKey(px, pz));
    }
  }
  return keys;
}

/** Migrate legacy centred plotSize saves into a parcel set. */
export function parcelsFromLegacyPlotSize(plotSize: number): string[] {
  const size = Math.max(START_PLOT_SIZE, Math.min(MAX_MAP_SIZE, plotSize || START_PLOT_SIZE));
  const o = plotOffset(size);
  const keys: string[] = [];
  for (let px = 0; px < PARCELS_AXIS; px++) {
    for (let pz = 0; pz < PARCELS_AXIS; pz++) {
      const c0 = px * PARCEL_SIZE;
      const c1 = c0 + PARCEL_SIZE;
      const r0 = pz * PARCEL_SIZE;
      const r1 = r0 + PARCEL_SIZE;
      const overlapX = c1 > o && c0 < o + size;
      const overlapZ = r1 > o && r0 < o + size;
      if (overlapX && overlapZ) keys.push(parcelKey(px, pz));
    }
  }
  return keys.length ? keys : createStarterParcels();
}

export function isOwnedParcel(
  px: number,
  pz: number,
  owned: ReadonlySet<string> | readonly string[],
): boolean {
  const key = parcelKey(px, pz);
  if (owned instanceof Set) return owned.has(key);
  return (owned as readonly string[]).includes(key);
}

export function isOwnedCell(
  cx: number,
  cz: number,
  owned: ReadonlySet<string> | readonly string[],
): boolean {
  if (cx < 0 || cz < 0 || cx >= MAX_MAP_SIZE || cz >= MAX_MAP_SIZE) return false;
  const { px, pz } = cellToParcel(cx, cz);
  return isOwnedParcel(px, pz, owned);
}

export interface OwnedExtent {
  /** World min/max of the owned AABB. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
  cx: number;
  cz: number;
  /** Approx. square edge for camera/shadow helpers. */
  plotSize: number;
}

export function ownedExtent(owned: readonly string[]): OwnedExtent {
  if (owned.length === 0) {
    const half = START_PLOT_SIZE / 2;
    return {
      minX: -half,
      maxX: half,
      minZ: -half,
      maxZ: half,
      width: START_PLOT_SIZE,
      depth: START_PLOT_SIZE,
      cx: 0,
      cz: 0,
      plotSize: START_PLOT_SIZE,
    };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const key of owned) {
    const { px, pz } = parseParcelKey(key);
    const b = parcelWorldBounds(px, pz);
    minX = Math.min(minX, b.min.x);
    maxX = Math.max(maxX, b.max.x);
    minZ = Math.min(minZ, b.min.z);
    maxZ = Math.max(maxZ, b.max.z);
  }
  const width = maxX - minX;
  const depth = maxZ - minZ;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    plotSize: Math.max(width, depth),
  };
}

export interface BuyableParcel {
  key: string;
  px: number;
  pz: number;
  cost: number;
  /** Rough compass hint relative to owned centroid. */
  direction: "N" | "E" | "S" | "W" | "NE" | "NW" | "SE" | "SW";
}

function parcelDirection(
  px: number,
  pz: number,
  centroid: { px: number; pz: number },
): BuyableParcel["direction"] {
  const dx = px - centroid.px;
  const dz = pz - centroid.pz;
  const absx = Math.abs(dx);
  const absz = Math.abs(dz);
  if (absz >= absx) {
    if (dz > 0) return dx > 0.4 ? "SE" : dx < -0.4 ? "SW" : "S";
    return dx > 0.4 ? "NE" : dx < -0.4 ? "NW" : "N";
  }
  if (dx > 0) return dz > 0.4 ? "SE" : dz < -0.4 ? "NE" : "E";
  return dz > 0.4 ? "SW" : dz < -0.4 ? "NW" : "W";
}

/** Cost to buy one more parcel (scales with how much land you already own). */
export function parcelPurchaseCost(ownedCount: number, px: number, pz: number): number {
  const base = 12_000;
  const tier = Math.max(0, ownedCount - 16) * 2_800;
  // South parcels (higher pz) sit by the entrance / parking — slight premium for access land.
  const southPremium = pz >= 5 ? 2_000 : 0;
  const dist = Math.abs(px - 3.5) + Math.abs(pz - 3.5);
  return Math.round(base + tier + dist * 1_200 + southPremium);
}

/** Unowned parcels that share an edge with at least one owned parcel. */
export function listBuyableParcels(owned: readonly string[]): BuyableParcel[] {
  const set = ownedParcelSet(owned);
  if (set.size === 0) return [];

  let sumPx = 0;
  let sumPz = 0;
  for (const key of owned) {
    const { px, pz } = parseParcelKey(key);
    sumPx += px;
    sumPz += pz;
  }
  const centroid = { px: sumPx / owned.length, pz: sumPz / owned.length };

  const candidates = new Map<string, { px: number; pz: number }>();
  for (const key of owned) {
    const { px, pz } = parseParcelKey(key);
    const neighbours = [
      { px: px + 1, pz },
      { px: px - 1, pz },
      { px, pz: pz + 1 },
      { px, pz: pz - 1 },
    ];
    for (const n of neighbours) {
      if (n.px < 0 || n.pz < 0 || n.px >= PARCELS_AXIS || n.pz >= PARCELS_AXIS) continue;
      const nk = parcelKey(n.px, n.pz);
      if (set.has(nk)) continue;
      candidates.set(nk, n);
    }
  }

  const out: BuyableParcel[] = [];
  for (const [key, { px, pz }] of candidates) {
    out.push({
      key,
      px,
      pz,
      cost: parcelPurchaseCost(owned.length, px, pz),
      direction: parcelDirection(px, pz, centroid),
    });
  }
  out.sort((a, b) => a.cost - b.cost || a.pz - b.pz || a.px - b.px);
  return out;
}

/** Amber outline segments for owned parcel edges that face wilderness. */
export function ownedBoundaryEdges(
  owned: readonly string[],
): Array<{ x: number; z: number; w: number; d: number }> {
  const set = ownedParcelSet(owned);
  const edges: Array<{ x: number; z: number; w: number; d: number }> = [];
  const t = 0.35;
  for (const key of owned) {
    const { px, pz } = parseParcelKey(key);
    const b = parcelWorldBounds(px, pz);
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    if (!isOwnedParcel(px, pz - 1, set)) {
      edges.push({ x: cx, z: b.min.z, w: PARCEL_SIZE, d: t });
    }
    if (!isOwnedParcel(px, pz + 1, set)) {
      edges.push({ x: cx, z: b.max.z, w: PARCEL_SIZE, d: t });
    }
    if (!isOwnedParcel(px - 1, pz, set)) {
      edges.push({ x: b.min.x, z: cz, w: t, d: PARCEL_SIZE });
    }
    if (!isOwnedParcel(px + 1, pz, set)) {
      edges.push({ x: b.max.x, z: cz, w: t, d: PARCEL_SIZE });
    }
  }
  return edges;
}
