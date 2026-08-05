/**
 * Wildhaven — authoritative game store (Zustand).
 *
 * Owns the full {@link GameState} (so pure helpers in game/*.ts and the HUD's
 * read selectors can consume `getState()` directly) plus a little world-view
 * state that the 3D scene needs (hover cell, current selection, build biome,
 * camera focus). Purely-presentational bits — which build tab is open, whether
 * the finance modal shows, dismissed toasts — live in the separate uiStore.
 *
 * Naming: `GameState.tick` is the numeric simulation counter, so the per-frame
 * stepping action is `step(dt)`.
 *
 * Heavy per-frame work (movement, spawning, income) lives in the pure helpers
 * in ../game/simulation.ts; `step()` orchestrates them.
 */

import { create } from "zustand";

import type {
  Animal,
  Biome,
  Building,
  BuildMode,
  GameState,
  Guest,
  Habitat,
  Staff,
  StaffRole,
  Vec2,
} from "../game/types";

import {
  applyCarePulse,
  applyDailyCare,
  deathMessage,
  lifespanForSpecies,
  type AnimalDeath,
} from "../game/care";
import { BUILDINGS_BY_ID, getBuilding } from "../game/buildings";
import { SPECIES_BY_ID } from "../game/species";
import { getStaffRole } from "../game/staffTypes";
import { computeWelfare } from "../game/welfare";
import {
  applyPurchase,
  createFinances,
  dailyAnimalCosts,
  dailyDonations,
  dailyStaffWages,
  dailyUpkeep,
  expectedDailyGuests,
  settleDay,
  transactionRevenue,
} from "../game/economy";
import {
  BIOME_CLIMATE,
  HALF,
  START_PLOT_SIZE,
  PLOT_STEP,
  MAX_PLOT_SIZE,
  alignFenceBuildings,
  canPlaceBuilding,
  collectFenceCells,
  floodFillEnclosure,
  footprintCenter,
  forgetEntity,
  landExpansionCost,
  plotOffset,
  cellCenter,
  spawnGuest as makeGuest,
  stepGuest,
  updateHabitatsFromBuildings,
  wanderAnimal,
} from "../game/simulation";

/* -------------------------------------------------------------------------- */
/*  Tunables                                                                  */
/* -------------------------------------------------------------------------- */

/** Real seconds per in-game day at speed ×1. */
const DAY_LENGTH_SECONDS = 90;
/** Hard cap on concurrent guests, for render performance. */
const MAX_GUESTS = 110;
/** How often (in ticks) to recompute welfare / needs. */
const WELFARE_INTERVAL = 45;

/** Cute names handed out to newly adopted animals. */
const NAMES = [
  "Amara", "Jabari", "Zuri", "Kito", "Nia", "Rajah", "Rosa", "Coral",
  "Bahati", "Chidi", "Dalila", "Enzi", "Faraji", "Goma", "Hasina", "Imani",
  "Juma", "Kesi", "Lulu", "Moyo", "Nuru", "Oba", "Penda", "Rudo",
];

/** Is this grid cell already inside a registered habitat? */
function cellCoveredByHabitat(habitats: Record<string, Habitat>, cell: Vec2): boolean {
  const c = cellCenter(cell);
  for (const h of Object.values(habitats)) {
    if (
      c.x >= h.bounds.min.x &&
      c.x <= h.bounds.max.x &&
      c.z >= h.bounds.min.z &&
      c.z <= h.bounds.max.z
    ) {
      return true;
    }
  }
  return false;
}

/**
 * After placing a fence piece, probe neighbouring empty cells for a newly
 * closed enclosure and register it with the active biome.
 */
function claimEnclosuresNear(cell: Vec2): void {
  const seeds = [
    { x: cell.x + 1, z: cell.z },
    { x: cell.x - 1, z: cell.z },
    { x: cell.x, z: cell.z + 1 },
    { x: cell.x, z: cell.z - 1 },
    { x: cell.x + 1, z: cell.z + 1 },
    { x: cell.x - 1, z: cell.z - 1 },
  ];
  for (const seed of seeds) {
    useGameStore.getState().createHabitat(seed);
  }
}
/* -------------------------------------------------------------------------- */
/*  Selection                                                                 */
/* -------------------------------------------------------------------------- */

export type SelectionKind = "animal" | "habitat" | "building" | "staff" | "guest";

export interface Selection {
  kind: SelectionKind;
  id: string;
}

export interface CreateHabitatOpts {
  name?: string;
  biome?: Biome;
}

/** One-shot alert kept until the player dismisses it (e.g. animal death). */
export interface DeathNotice {
  id: string;
  animalId: string;
  title: string;
  message: string;
  day: number;
}

/* -------------------------------------------------------------------------- */
/*  Store shape                                                               */
/* -------------------------------------------------------------------------- */

export interface ZooStore extends GameState {
  /* --- world-view state --- */
  paused: boolean;
  selection: Selection | null;
  hoverCell: Vec2 | null;
  buildBiome: Biome;
  cameraTarget: [number, number, number];
  focusAnimalId: string | null;
  /** Recent animal deaths awaiting toast display / dismiss. */
  deathNotices: DeathNotice[];

  /* --- clock / speed --- */
  step: (dt: number) => void;
  advanceDay: () => void;
  setSpeed: (speed: number) => void;
  setPaused: (paused: boolean) => void;
  setCameraTarget: (target: [number, number, number]) => void;
  focusAnimal: (id: string | null) => void;

  /* --- build & tools --- */
  setBuildMode: (patch: Partial<BuildMode>) => void;
  setBuildBiome: (biome: Biome) => void;
  setHoverCell: (cell: Vec2 | null) => void;

  /* --- world mutations --- */
  placeBuilding: (defId: string, cell: Vec2, rotation?: number) => void;
  demolish: (instanceId: string) => void;
  createHabitat: (seed: Vec2, opts?: CreateHabitatOpts) => string | null;
  addAnimalToHabitat: (speciesId: string, habitatId: string, at?: Vec2) => void;
  hireStaff: (role: StaffRole) => void;
  /** Expand the owned plot by PLOT_STEP if affordable. Returns false if blocked. */
  buyLand: () => boolean;
  /** Change an existing habitat's biome (and matching climate). */
  setHabitatBiome: (habitatId: string, biome: Biome) => void;
  /** Clear a death toast after the player dismisses it. */
  dismissDeathNotice: (id: string) => void;

  /* --- selection --- */
  selectEntity: (selection: Selection | null) => void;

  /* --- finance --- */
  setTicketPrice: (price: number) => void;
}

/* -------------------------------------------------------------------------- */
/*  Id generation                                                             */
/* -------------------------------------------------------------------------- */

let idCounter = 0;
const uid = (prefix: string): string => `${prefix}-${++idCounter}`;

/* -------------------------------------------------------------------------- */
/*  Initial state                                                             */
/* -------------------------------------------------------------------------- */

function makeBuilding(defId: string, cell: Vec2, rotation = 0, habitatId?: string): Building {
  const def = BUILDINGS_BY_ID[defId];
  const category = def?.category ?? "scenery";
  return {
    instanceId: uid("b"),
    defId,
    category,
    position: footprintCenter(cell, def, rotation),
    rotation,
    habitatId,
    condition: 100,
  };
}

type ViewState = {
  paused: boolean;
  selection: Selection | null;
  hoverCell: Vec2 | null;
  buildBiome: Biome;
  cameraTarget: [number, number, number];
  focusAnimalId: string | null;
  deathNotices: DeathNotice[];
};

function createInitialState(): GameState & ViewState {
  const buildings: Record<string, Building> = {};
  const add = (b: Building) => {
    buildings[b.instanceId] = b;
  };

  const plotSize = START_PLOT_SIZE;
  const o = plotOffset(plotSize);
  // Entrance on the south edge of the owned plot.
  add(makeBuilding("entrance-arch", { x: o + plotSize / 2 - 3, z: o + plotSize - 4 }));

  // Path running north from the entrance toward the centre.
  for (let z = o + plotSize - 6; z >= o + plotSize / 2; z -= 2) {
    add(makeBuilding("path", { x: o + plotSize / 2 - 1, z }));
  }

  return {
    tick: 0,
    day: 1,
    timeOfDay: 0.4,
    ambientTemp: 22,
    speed: 1,

    finances: createFinances(75_000),
    plotSize,

    habitats: {},
    animals: {},
    guests: {},
    staff: {},
    buildings,

    unlockedSpecies: Object.keys(SPECIES_BY_ID),

    build: {
      active: false,
      tool: "none",
      selectedDefId: undefined,
      selectedSpeciesId: undefined,
      rotation: 0,
      gridSize: 1,
      valid: true,
    },

    stats: {
      guestCount: 0,
      averageGuestHappiness: 0,
      averageAnimalWelfare: 0,
      rating: 0,
    },

    paused: false,
    selection: null,
    hoverCell: null,
    buildBiome: "savanna",
    cameraTarget: [0, 0, 0],
    focusAnimalId: null,
    deathNotices: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Derived helpers                                                           */
/* -------------------------------------------------------------------------- */

type SimSlice = Pick<GameState, "animals" | "buildings" | "finances" | "habitats">;

/** Aggregate park appeal from animals (weighted by welfare) plus a baseline. */
function computeAppeal(s: SimSlice): number {
  let appeal = 8;
  for (const a of Object.values(s.animals)) {
    const def = SPECIES_BY_ID[a.speciesId];
    if (!def) continue;
    appeal += def.appeal * (0.4 + (a.welfare / 100) * 0.6) * 0.35;
  }
  return appeal;
}

/** World-space centres of every guest path / amenity tile (guest waypoints). */
function pathWaypoints(s: SimSlice): Vec2[] {
  const pts: Vec2[] = [];
  for (const b of Object.values(s.buildings)) {
    if (b.defId === "path" || b.category === "guest") {
      pts.push({ x: b.position.x, z: b.position.z });
    }
  }
  return pts;
}

/** The entrance position guests spawn at (falls back to south-centre). */
function entrancePosition(s: SimSlice): Vec2 {
  const arch = Object.values(s.buildings).find((b) => b.defId === "entrance-arch");
  return arch ? { x: arch.position.x, z: arch.position.z } : { x: 0, z: HALF - 2 };
}

/** Herd size (same-species animals) within a habitat. */
function herdSize(habitat: Habitat, animals: Record<string, Animal>, speciesId: string): number {
  let n = 0;
  for (const id of habitat.animalIds) {
    if (animals[id]?.speciesId === speciesId) n++;
  }
  return Math.max(1, n);
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function noticesFromDeaths(
  deaths: AnimalDeath[],
  day: number,
  existing: DeathNotice[],
): DeathNotice[] {
  if (deaths.length === 0) return existing;
  const added = deaths.map((d) => {
    const msg = deathMessage(d);
    return {
      id: `death-${d.id}-${day}`,
      animalId: d.id,
      title: msg.title,
      message: msg.message,
      day,
    };
  });
  return [...existing, ...added].slice(-12);
}

function clearSelectionIfDead(
  selection: Selection | null,
  focusAnimalId: string | null,
  deaths: AnimalDeath[],
): { selection: Selection | null; focusAnimalId: string | null } {
  if (deaths.length === 0) return { selection, focusAnimalId };
  const dead = new Set(deaths.map((d) => d.id));
  for (const id of dead) forgetEntity(id);
  return {
    selection:
      selection?.kind === "animal" && dead.has(selection.id) ? null : selection,
    focusAnimalId: focusAnimalId && dead.has(focusAnimalId) ? null : focusAnimalId,
  };
}

/** Recompute cached welfare scores after care changes hunger/health. */
function refreshWelfareScores(
  animals: Record<string, Animal>,
  habitats: Record<string, Habitat>,
): Record<string, Animal> {
  const next: Record<string, Animal> = {};
  for (const a of Object.values(animals)) {
    const habitat = a.habitatId ? habitats[a.habitatId] : undefined;
    if (!habitat) {
      next[a.id] = a;
      continue;
    }
    const herd = herdSize(habitat, animals, a.speciesId);
    next[a.id] = { ...a, welfare: computeWelfare(a, habitat, herd).score };
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/*  Store                                                                     */
/* -------------------------------------------------------------------------- */

export const useGameStore = create<ZooStore>((set, get) => ({
  ...createInitialState(),

  /* ---- clock / per-frame simulation ---- */

  step: (dt) => {
    const s = get();
    if (s.paused) return;

    const sdt = dt * s.speed;
    const dayFrac = sdt / DAY_LENGTH_SECONDS;
    const tick = s.tick + 1;

    // Advance the clock; roll over into a new day when it wraps past 1.
    let timeOfDay = s.timeOfDay + dayFrac;
    let rolled = false;
    if (timeOfDay >= 1) {
      timeOfDay -= 1;
      rolled = true;
    }

    // --- animals: wander + periodic needs / keeper care / death ------------
    const doWelfare = tick % WELFARE_INTERVAL === 0;
    let animals: Record<string, Animal> = {};
    for (const a of Object.values(s.animals)) {
      const habitat = a.habitatId ? s.habitats[a.habitatId] : undefined;
      const position = wanderAnimal(a, habitat, sdt);
      let next: Animal = { ...a, position };
      if (doWelfare && habitat) {
        const hunger = clamp(a.hunger - 0.5, 0, 100);
        next = { ...next, hunger };
      }
      animals[a.id] = next;
    }

    let habitats = s.habitats;
    let staff = s.staff;
    let deathNotices = s.deathNotices;
    let selection = s.selection;
    let focusAnimalId = s.focusAnimalId;

    if (doWelfare) {
      const cared = applyCarePulse(animals, habitats, staff, s.buildings);
      animals = refreshWelfareScores(cared.animals, cared.habitats);
      habitats = cared.habitats;
      staff = cared.staff;
      deathNotices = noticesFromDeaths(cared.deaths, s.day, deathNotices);
      const cleared = clearSelectionIfDead(selection, focusAnimalId, cared.deaths);
      selection = cleared.selection;
      focusAnimalId = cleared.focusAnimalId;
    }

    // --- guests: move, age out, keep happy ---------------------------------
    const waypoints = pathWaypoints(s);
    const appeal = computeAppeal(s);
    const targetHappy = clamp(45 + appeal, 0, 100);
    const guests: Record<string, Guest> = {};
    for (const g of Object.values(s.guests)) {
      const moved = stepGuest(g, waypoints, sdt);
      if (moved.patience <= 0) continue; // guest goes home
      const happiness = moved.happiness + (targetHappy - moved.happiness) * 0.4 * sdt;
      guests[g.id] = { ...moved, happiness: clamp(happiness, 0, 100) };
    }

    // --- guest arrivals ----------------------------------------------------
    const desired = Math.min(MAX_GUESTS, expectedDailyGuests(appeal, s.finances.ticketPrice));
    let guestCount = Object.keys(guests).length;
    let ticketEarned = 0;
    if (guestCount < desired && waypoints.length > 0) {
      // Arrival rate scales with how far below the target we are.
      const rate = (desired - guestCount) * 0.6 * sdt;
      if (Math.random() < rate) {
        const g = makeGuest(uid("g"), guestCount, entrancePosition(s));
        guests[g.id] = g;
        guestCount++;
        ticketEarned += s.finances.ticketPrice;
      }
    }

    // --- income accrual (folded into the ledger; cash settles at day end) --
    const avgHappiness = guestCount
      ? Object.values(guests).reduce((n, g) => n + g.happiness, 0) / guestCount
      : 0;
    let shopPerDay = 0;
    let infoBoards = 0;
    for (const b of Object.values(s.buildings)) {
      const def = getBuilding(b.defId);
      if (!def) continue;
      if (def.revenuePerUse) {
        shopPerDay += transactionRevenue(def, avgHappiness) * guestCount * 0.12;
      }
      if (b.defId === "info-board") infoBoards++;
    }
    const donationPerDay = dailyDonations(guestCount, avgHappiness, infoBoards);

    const today = {
      ...s.finances.today,
      ticketIncome: s.finances.today.ticketIncome + ticketEarned,
      shopIncome: s.finances.today.shopIncome + shopPerDay * dayFrac,
      donationIncome: s.finances.today.donationIncome + donationPerDay * dayFrac,
    };

    set({
      tick,
      timeOfDay,
      animals,
      habitats,
      staff,
      guests,
      deathNotices,
      selection,
      focusAnimalId,
      finances: { ...s.finances, today },
      stats: {
        ...s.stats,
        guestCount,
        averageGuestHappiness: Math.round(avgHappiness),
      },
    });

    if (rolled) get().advanceDay();
  },

  advanceDay: () =>
    set((s) => {
      // Daily hunger drain + ageing first, then keeper/vet care and deaths.
      const aged: Record<string, Animal> = {};
      for (const a of Object.values(s.animals)) {
        aged[a.id] = {
          ...a,
          hunger: clamp(a.hunger - 6, 0, 100),
          age: a.age + 1,
        };
      }

      const cared = applyDailyCare(aged, s.habitats, s.staff, s.buildings);
      const animals = refreshWelfareScores(cared.animals, cared.habitats);
      const habitats = cared.habitats;
      const staff = cared.staff;
      const deathNotices = noticesFromDeaths(cared.deaths, s.day + 1, s.deathNotices);
      const cleared = clearSelectionIfDead(s.selection, s.focusAnimalId, cared.deaths);

      const animalList = Object.values(animals);
      let welfareSum = 0;
      for (const a of animalList) welfareSum += a.welfare;

      const conservationEarned = animalList.reduce((n, a) => {
        const def = SPECIES_BY_ID[a.speciesId];
        const rare = def && ["VU", "EN", "CR", "EW"].includes(def.conservationStatus);
        return n + (rare && a.welfare > 70 ? 2 : 0);
      }, 0);

      const finances = settleDay(s.finances, {
        animalCosts: dailyAnimalCosts(animals),
        staffWages: dailyStaffWages(staff),
        upkeep: dailyUpkeep(s.buildings),
        conservationEarned,
      });

      const buildings: Record<string, Building> = {};
      for (const [id, b] of Object.entries(s.buildings)) {
        // Mechanics slow building wear.
        const mechanicCount = Object.values(staff).filter((m) => m.role === "mechanic").length;
        const wear = Math.max(0.15, 0.5 - mechanicCount * 0.12);
        buildings[id] = { ...b, condition: Math.max(0, b.condition - wear) };
      }

      const guestList = Object.values(s.guests);
      const guestCount = guestList.length;
      const averageAnimalWelfare = animalList.length
        ? Math.round(welfareSum / animalList.length)
        : 0;
      const averageGuestHappiness = guestCount
        ? Math.round(guestList.reduce((sum, g) => sum + g.happiness, 0) / guestCount)
        : 0;
      const rating = Math.max(
        0,
        Math.min(5, (averageAnimalWelfare / 100) * 2.5 + (averageGuestHappiness / 100) * 2.5),
      );

      return {
        day: s.day + 1,
        finances,
        animals,
        habitats,
        staff,
        buildings,
        deathNotices,
        selection: cleared.selection,
        focusAnimalId: cleared.focusAnimalId,
        stats: { guestCount, averageGuestHappiness, averageAnimalWelfare, rating },
      };
    }),

  setSpeed: (speed) => set({ speed: clamp(Math.round(speed), 1, 3) }),
  setPaused: (paused) => set({ paused }),
  setCameraTarget: (cameraTarget) => set({ cameraTarget }),
  focusAnimal: (focusAnimalId) =>
    set((s) => {
      if (!focusAnimalId) return { focusAnimalId: null };
      const a = s.animals[focusAnimalId];
      return {
        focusAnimalId,
        cameraTarget: a ? [a.position.x, 0, a.position.z] : s.cameraTarget,
      };
    }),

  /* ---- build & tools ---- */

  setBuildMode: (patch) => set((s) => ({ build: { ...s.build, ...patch } })),
  setBuildBiome: (buildBiome) => set({ buildBiome }),
  setHoverCell: (hoverCell) =>
    set((s) => {
      if (!hoverCell) {
        return { hoverCell: null, build: { ...s.build, valid: true } };
      }
      const defId =
        s.build.selectedDefId ??
        (s.build.tool === "fence"
          ? "fence-segment"
          : s.build.tool === "gate"
            ? "habitat-gate"
            : undefined);
      if (!defId) {
        return { hoverCell, build: { ...s.build, valid: true } };
      }
      const valid = canPlaceBuilding(
        s.buildings,
        defId,
        hoverCell,
        s.build.rotation,
        s.plotSize,
      );
      return { hoverCell, build: { ...s.build, valid } };
    }),

  /* ---- world mutations ---- */

  placeBuilding: (defId, cell, rotation = 0) => {
    const s = get();
    const def = getBuilding(defId);
    if (!def) return;
    if (!canPlaceBuilding(s.buildings, defId, cell, rotation, s.plotSize)) return;
    if (s.finances.cash < def.cost) return;

    const building = makeBuilding(defId, cell, rotation);
    const buildings = { ...s.buildings, [building.instanceId]: building };
    let habitats = updateHabitatsFromBuildings(s.habitats, buildings);
    set({ buildings, habitats, finances: applyPurchase(s.finances, def.cost) });

    // Closing a fence loop should register a habitat with the active biome.
    if (defId === "fence-segment" || defId === "habitat-gate") {
      claimEnclosuresNear(cell);
    }
  },

  demolish: (instanceId) => {
    const s = get();
    if (!s.buildings[instanceId]) return;
    const buildings = { ...s.buildings };
    delete buildings[instanceId];
    const habitats = updateHabitatsFromBuildings(s.habitats, buildings);
    const selection =
      s.selection?.kind === "building" && s.selection.id === instanceId
        ? null
        : s.selection;
    set({ buildings, habitats, selection });
  },

  createHabitat: (seed, opts) => {
    const s = get();
    if (cellCoveredByHabitat(s.habitats, seed)) return null;

    const fenceCells = collectFenceCells(s.buildings);
    const enclosure = floodFillEnclosure(seed, fenceCells);
    if (!enclosure.bounded || enclosure.cells.size < 4) return null;

    // Don't claim a region that already overlaps an existing habitat heavily.
    for (const h of Object.values(s.habitats)) {
      const ox = Math.max(enclosure.bounds.min.x, h.bounds.min.x);
      const oz = Math.max(enclosure.bounds.min.z, h.bounds.min.z);
      const ox2 = Math.min(enclosure.bounds.max.x, h.bounds.max.x);
      const oz2 = Math.min(enclosure.bounds.max.z, h.bounds.max.z);
      if (ox2 > ox && oz2 > oz) return null;
    }

    const biome = opts?.biome ?? s.buildBiome;
    const climate = BIOME_CLIMATE[biome];
    const id = uid("hab");
    const w = enclosure.bounds.max.x - enclosure.bounds.min.x;
    const d = enclosure.bounds.max.z - enclosure.bounds.min.z;

    const habitat: Habitat = {
      id,
      name: opts?.name ?? `${capitalize(biome)} Enclosure`,
      biome,
      bounds: enclosure.bounds,
      area: Math.max(1, Math.round(w * d)),
      fenced: true,
      temperature: climate.temperature,
      humidity: climate.humidity,
      hygiene: 90,
      enrichmentProvided: [],
      animalIds: [],
      buildingIds: [],
    };
    set({
      habitats: updateHabitatsFromBuildings({ ...s.habitats, [id]: habitat }, s.buildings),
      selection: { kind: "habitat", id },
    });
    return id;
  },

  setHabitatBiome: (habitatId, biome) => {
    const s = get();
    const h = s.habitats[habitatId];
    if (!h) return;
    const climate = BIOME_CLIMATE[biome];
    const next: Habitat = {
      ...h,
      biome,
      temperature: climate.temperature,
      humidity: climate.humidity,
      name: h.name.includes("Enclosure")
        ? `${capitalize(biome)} Enclosure`
        : h.name,
    };

    // Refresh welfare for animals living here.
    const animals: Record<string, Animal> = { ...s.animals };
    for (const aid of next.animalIds) {
      const a = animals[aid];
      if (!a) continue;
      const herd = herdSize(next, animals, a.speciesId);
      animals[aid] = {
        ...a,
        welfare: computeWelfare(a, next, herd).score,
      };
    }

    set({
      habitats: { ...s.habitats, [habitatId]: next },
      animals,
      buildBiome: biome,
    });
  },

  addAnimalToHabitat: (speciesId, habitatId, at) => {
    const s = get();
    const def = SPECIES_BY_ID[speciesId];
    const habitat = s.habitats[habitatId];
    if (!def || !habitat) return;
    if (s.finances.cash < def.cost) return;

    const id = uid("a");
    const cx = (habitat.bounds.min.x + habitat.bounds.max.x) / 2;
    const cz = (habitat.bounds.min.z + habitat.bounds.max.z) / 2;
    const pad = 0.6;
    const clampIn = (v: number, lo: number, hi: number) =>
      Math.min(hi - pad, Math.max(lo + pad, v));
    const position: Vec2 = at
      ? {
          x: clampIn(at.x, habitat.bounds.min.x, habitat.bounds.max.x),
          z: clampIn(at.z, habitat.bounds.min.z, habitat.bounds.max.z),
        }
      : { x: cx + (Math.random() - 0.5) * 4, z: cz + (Math.random() - 0.5) * 4 };

    const animal: Animal = {
      id,
      speciesId,
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      habitatId,
      position,
      age: 120 + Math.floor(Math.random() * 300),
      lifespan: lifespanForSpecies(speciesId),
      sex: Math.random() < 0.5 ? "male" : "female",
      health: 95,
      hunger: 85,
      welfare: 70,
      sick: false,
      breedCooldown: 0,
    };

    const nextHabitat: Habitat = {
      ...habitat,
      animalIds: [...habitat.animalIds, id],
      speciesId: habitat.speciesId ?? speciesId,
    };
    const animals = { ...s.animals, [id]: animal };
    animal.welfare = computeWelfare(animal, nextHabitat, herdSize(nextHabitat, animals, speciesId)).score;

    set({
      animals,
      habitats: { ...s.habitats, [habitatId]: nextHabitat },
      finances: applyPurchase(s.finances, def.cost),
    });
  },

  hireStaff: (role) => {
    const s = get();
    const def = getStaffRole(role);
    if (!def || s.finances.cash < def.hireCost) return;
    const id = uid("s");
    const count = Object.values(s.staff).filter((m) => m.role === role).length;
    const habitatIds = Object.values(s.habitats)
      .filter((h) => h.animalIds.length > 0)
      .map((h) => h.id);
    const primary = habitatIds[count % Math.max(1, habitatIds.length)];
    const member: Staff = {
      id,
      role,
      name: `${def.name} ${count + 1}`,
      position: { x: (Math.random() - 0.5) * 6, z: 2 },
      energy: 90,
      assignments: primary ? [primary] : [],
      targetId: primary,
    };
    set({ staff: { ...s.staff, [id]: member }, finances: applyPurchase(s.finances, def.hireCost) });
  },

  buyLand: () => {
    const s = get();
    if (s.plotSize >= MAX_PLOT_SIZE) return false;
    const cost = landExpansionCost(s.plotSize);
    if (s.finances.cash < cost) return false;
    set({
      plotSize: Math.min(MAX_PLOT_SIZE, s.plotSize + PLOT_STEP),
      finances: applyPurchase(s.finances, cost),
    });
    return true;
  },

  /* ---- selection & finance ---- */

  selectEntity: (selection) => set({ selection }),
  dismissDeathNotice: (id) =>
    set((s) => ({ deathNotices: s.deathNotices.filter((n) => n.id !== id) })),
  setTicketPrice: (price) =>
    set((s) => ({ finances: { ...s.finances, ticketPrice: clamp(Math.round(price), 0, 60) } })),
}));

/* -------------------------------------------------------------------------- */
/*  Persistence & standalone helpers used by the UI                          */
/* -------------------------------------------------------------------------- */

export const SAVE_KEY = "wildhaven-save";

/** Persisted slice — everything needed to resume a park. */
interface SavedPark {
  version: 1;
  savedAt: number;
  state: Pick<
    GameState,
    | "tick"
    | "day"
    | "timeOfDay"
    | "ambientTemp"
    | "speed"
    | "finances"
    | "plotSize"
    | "habitats"
    | "animals"
    | "guests"
    | "staff"
    | "buildings"
    | "unlockedSpecies"
    | "stats"
  >;
}

/** Whether a saved park exists in localStorage (used by the title screen). */
export function saveExists(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Write the current park to localStorage. Returns true on success. */
export function saveGame(): boolean {
  try {
    const s = useGameStore.getState();
    const payload: SavedPark = {
      version: 1,
      savedAt: Date.now(),
      state: {
        tick: s.tick,
        day: s.day,
        timeOfDay: s.timeOfDay,
        ambientTemp: s.ambientTemp,
        speed: s.speed,
        finances: s.finances,
        plotSize: s.plotSize,
        habitats: s.habitats,
        animals: s.animals,
        guests: s.guests,
        staff: s.staff,
        buildings: s.buildings,
        unlockedSpecies: s.unlockedSpecies,
        stats: s.stats,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Restore a park from localStorage. Returns true if a save was loaded. */
export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SavedPark;
    if (!parsed?.state?.habitats) return false;
    const buildings = alignFenceBuildings(parsed.state.buildings ?? {});
    useGameStore.setState({
      ...parsed.state,
      buildings,
      plotSize: parsed.state.plotSize ?? START_PLOT_SIZE,
      paused: false,
      selection: null,
      hoverCell: null,
      focusAnimalId: null,
      deathNotices: [],
      build: {
        active: false,
        tool: "none",
        selectedDefId: undefined,
        selectedSpeciesId: undefined,
        rotation: 0,
        gridSize: 1,
        valid: true,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Release cached per-entity motion state (e.g. when demolishing/removing). */
export function forgetSimEntity(id: string): void {
  forgetEntity(id);
}
