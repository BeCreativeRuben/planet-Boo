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
  Litter,
  Staff,
  StaffRole,
  Vec2,
} from "../game/types";

import {
  applyCarePulse,
  applyDailyCare,
  deathMessage,
  lifespanForSpecies,
  spawnAgeForLifespan,
  type AnimalDeath,
} from "../game/care";
import { BUILDINGS_BY_ID, getBuilding } from "../game/buildings";
import {
  DAY_LENGTH_SECONDS,
  HUNGER_DRAIN_PER_DAY,
  NIGHT_CARE_MULT,
  NIGHT_REPAIR_MULT,
  getDayPhase,
  guestArrivalFactor,
  guestLeaveFactor,
  isNightPhase,
} from "../game/dayCycle";
import { SPECIES_BY_ID } from "../game/species";
import { getStaffRole } from "../game/staffTypes";
import { computeWelfare } from "../game/welfare";
import {
  LITTER_DROP_RATE,
  applyJanitorPulse,
  disposeGuestTrash,
  messHappinessPenalty,
} from "../game/sanitation";
import {
  buildViewpoints,
  migrateGuest,
  spawnGuestParty,
  stepGuestBehavior,
} from "../game/guests";
import {
  applyPurchase,
  applyOperatingDelta,
  createFinances,
  dailyAnimalCosts,
  dailyDonations,
  dailyStaffWages,
  dailyUpkeep,
  expectedDailyGuests,
  parkingGuestCapacity,
  settleDay,
  transactionRevenue,
  shopOpenFactor,
  vendorBoost,
} from "../game/economy";
import {
  BIOME_CLIMATE,
  HALF,
  START_PLOT_SIZE,
  alignFenceBuildings,
  canPlaceBuilding,
  collectFenceCells,
  floodFillEnclosure,
  footprintCenter,
  forgetEntity,
  plotOffset,
  cellCenter,
  worldToCell,
  updateHabitatsFromBuildings,
  wanderAnimal,
  realignHabitatsToFences,
  expandBounds,
  guestWalkable,
  GUEST_FENCE_CLEARANCE,
} from "../game/simulation";
import {
  createStarterParcels,
  listBuyableParcels,
  ownedExtent,
  parcelsFromLegacyPlotSize,
} from "../game/parcels";

/* -------------------------------------------------------------------------- */
/*  Tunables                                                                  */
/* -------------------------------------------------------------------------- */

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
  /**
   * Buy an adjacent land parcel by key (`"px,pz"`). Returns false if the parcel
   * isn't buyable or cash is short.
   */
  buyParcel: (key: string) => boolean;
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
    salesToday: 0,
    customersToday: 0,
    salesLifetime: 0,
    customersLifetime: 0,
    fillLevel: defId === "trash-bin" ? 0 : undefined,
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

  const ownedParcels = createStarterParcels();
  const plotSize = ownedExtent(ownedParcels).plotSize;
  const o = plotOffset(START_PLOT_SIZE);
  // South strip: parking on the edge, entrance just north, path into the park.
  add(makeBuilding("parking-lot", { x: o + START_PLOT_SIZE / 2 - 6, z: o + START_PLOT_SIZE - 7 }));
  add(makeBuilding("entrance-arch", { x: o + START_PLOT_SIZE / 2 - 3, z: o + START_PLOT_SIZE - 10 }));

  // Path running north from the entrance toward the centre.
  for (let z = o + START_PLOT_SIZE - 12; z >= o + START_PLOT_SIZE / 2; z -= 2) {
    add(makeBuilding("path", { x: o + START_PLOT_SIZE / 2 - 1, z }));
  }
  // Litter bins along the entrance path.
  add(makeBuilding("trash-bin", { x: o + START_PLOT_SIZE / 2 + 1, z: o + START_PLOT_SIZE - 14 }));
  add(makeBuilding("trash-bin", { x: o + START_PLOT_SIZE / 2 - 3, z: o + START_PLOT_SIZE / 2 + 4 }));
  add(makeBuilding("trash-bin", { x: o + START_PLOT_SIZE / 2 + 2, z: o + START_PLOT_SIZE / 2 - 2 }));

  return {
    tick: 0,
    day: 1,
    timeOfDay: 0.4,
    ambientTemp: 22,
    speed: 1,

    finances: createFinances(75_000),
    ownedParcels,
    plotSize,

    habitats: {},
    animals: {},
    guests: {},
    staff: {},
    buildings,
    litter: {},

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
  const fenceCells = collectFenceCells(s.buildings);
  const blocked = Object.values(s.habitats).map((h) =>
    expandBounds(h.bounds, GUEST_FENCE_CLEARANCE),
  );
  const pts: Vec2[] = [];
  for (const b of Object.values(s.buildings)) {
    if (b.defId !== "path" && b.category !== "guest") continue;
    const p = { x: b.position.x, z: b.position.z };
    // Keep guests on public paths — never route through enclosures or onto fences.
    if (!guestWalkable(p, blocked, fenceCells)) continue;
    pts.push(p);
  }
  return pts;
}

/** The entrance / parking arrival position guests spawn at. */
function entrancePosition(s: SimSlice & Pick<GameState, "buildings">): Vec2 {
  const parking = Object.values(s.buildings).find((b) => b.defId === "parking-lot");
  if (parking) {
    // Arrive at the north edge of the lot, walking toward the gate.
    return { x: parking.position.x, z: parking.position.z - 2.2 };
  }
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

    // --- animals: wander + continuous hunger / keeper care / death ---------
    const phase = getDayPhase(timeOfDay);
    const night = isNightPhase(phase);
    const hungerDrain = HUNGER_DRAIN_PER_DAY * 100 * dayFrac;
    const doWelfare = tick % WELFARE_INTERVAL === 0;
    let animals: Record<string, Animal> = {};
    for (const a of Object.values(s.animals)) {
      const habitat = a.habitatId ? s.habitats[a.habitatId] : undefined;
      const position = wanderAnimal(a, habitat, sdt);
      const hunger = clamp(a.hunger - hungerDrain, 0, 100);
      animals[a.id] = { ...a, position, hunger };
    }

    let habitats = s.habitats;
    let staff = s.staff;
    let deathNotices = s.deathNotices;
    let selection = s.selection;
    let focusAnimalId = s.focusAnimalId;
    let buildings: Record<string, Building> = { ...s.buildings };
    let litter: Record<string, Litter> = { ...s.litter };

    if (doWelfare) {
      const careMult = night ? NIGHT_CARE_MULT : 1;
      const cared = applyCarePulse(animals, habitats, staff, buildings, careMult);
      animals = refreshWelfareScores(cared.animals, cared.habitats);
      habitats = cared.habitats;
      staff = cared.staff;
      deathNotices = noticesFromDeaths(cared.deaths, s.day, deathNotices);
      const cleared = clearSelectionIfDead(selection, focusAnimalId, cared.deaths);
      selection = cleared.selection;
      focusAnimalId = cleared.focusAnimalId;

      // Janitors empty bins and clear path litter (faster at night).
      const sanitized = applyJanitorPulse(buildings, litter, staff, careMult);
      buildings = sanitized.buildings;
      litter = sanitized.litter;
      staff = sanitized.staff;

      // Night shift: mechanics patch buildings while the park is empty.
      if (night) {
        const mechanicCount = Object.values(staff).filter((m) => m.role === "mechanic").length;
        if (mechanicCount > 0) {
          const repair = mechanicCount * 0.35 * NIGHT_REPAIR_MULT;
          const nextBuildings: Record<string, Building> = {};
          for (const [id, b] of Object.entries(buildings)) {
            nextBuildings[id] = {
              ...b,
              condition: clamp(b.condition + repair, 0, 100),
            };
          }
          buildings = nextBuildings;
        }
      }
    }

    // --- guests: stroll, view animals, leave when patience runs out --------
    const waypoints = pathWaypoints(s);
    const fenceCells = collectFenceCells(buildings);
    const blockedHabitats = Object.values(habitats).map((h) =>
      expandBounds(h.bounds, GUEST_FENCE_CLEARANCE),
    );
    const viewpoints = buildViewpoints(habitats, buildings, fenceCells);
    const appeal = computeAppeal(s);
    const messPenalty = messHappinessPenalty(buildings, litter);
    const targetHappy = clamp(45 + appeal - messPenalty, 0, 100);
    const leaveMult = guestLeaveFactor(timeOfDay);

    // Snapshot for follower→leader lookups during the step.
    const guestSnapshot = s.guests;
    const guests: Record<string, Guest> = {};

    // Step leaders first so followers can track updated positions.
    const ordered = Object.values(s.guests).sort((a, b) => Number(b.leader) - Number(a.leader));
    for (const raw of ordered) {
      const g = migrateGuest(raw, raw.id);
      const livePeers = { ...guestSnapshot, ...guests };
      const moved = stepGuestBehavior(g, {
        waypoints,
        viewpoints,
        habitats,
        blocked: blockedHabitats,
        fenceCells,
        guests: livePeers,
        dt: sdt,
      });
      // Extra dusk/night leave pressure (viewing already drains slower).
      const patience =
        moved.activity === "view"
          ? moved.patience - sdt * (leaveMult - 1) * 0.25
          : moved.patience - sdt * (leaveMult - 1);
      if (patience <= 0) continue;
      // Ambient happiness drifts toward park target; viewing adds on top in stepGuestBehavior.
      const happiness =
        moved.activity === "view"
          ? moved.happiness
          : moved.happiness + (targetHappy - moved.happiness) * 0.25 * sdt;
      guests[moved.id] = { ...moved, patience, happiness: clamp(happiness, 0, 100) };

      // Visitors drop trash — bins catch it when nearby, else ground litter.
      if (Math.random() < LITTER_DROP_RATE * sdt) {
        const dumped = disposeGuestTrash(moved.position, buildings, litter, () => uid("lit"));
        buildings = dumped.buildings;
        litter = dumped.litter;
      }
    }

    // --- guest arrivals: parties / families (none at night) ----------------
    // Appeal sets demand; parking stalls are a hard shared capacity across all lots.
    const desired = Math.min(
      MAX_GUESTS,
      parkingGuestCapacity(buildings),
      Math.round(expectedDailyGuests(appeal, s.finances.ticketPrice)),
    );
    let guestCount = Object.keys(guests).length;
    let ticketEarned = 0;
    const arriveMult = guestArrivalFactor(timeOfDay);
    if (arriveMult > 0 && guestCount < desired - 1 && waypoints.length > 0) {
      // Lower rate than old solo spawn — each success brings a whole party.
      const rate = (desired - guestCount) * 0.22 * sdt * arriveMult;
      if (Math.random() < rate) {
        const party = spawnGuestParty(entrancePosition(s), () => uid("g"), guestCount);
        for (const member of party) {
          if (guestCount >= MAX_GUESTS) break;
          guests[member.id] = member;
          guestCount++;
          // Children still need a ticket, but a bit cheaper.
          ticketEarned +=
            member.kind === "child" ? s.finances.ticketPrice * 0.5 : s.finances.ticketPrice;
        }
      }
    }

    // --- income + running costs accrue into ledger AND cash continuously ---
    const avgHappiness = guestCount
      ? Object.values(guests).reduce((n, g) => n + g.happiness, 0) / guestCount
      : 0;
    const vendorCount = Object.values(staff).filter((m) => m.role === "vendor").length;
    const vBoost = vendorBoost(vendorCount);
    let shopPerDay = 0;
    let infoBoards = 0;

    for (const b of Object.values(buildings)) {
      const def = getBuilding(b.defId);
      if (!def) continue;
      if (b.defId === "info-board") infoBoards++;
      if (!def.revenuePerUse) continue;

      const open = shopOpenFactor(timeOfDay, b.condition);
      // Guests-per-day visit rate for this stall at full open.
      const visitsPerDay = guestCount * 0.12 * vBoost;
      const earnPerDay = transactionRevenue(def, avgHappiness) * visitsPerDay * open;
      shopPerDay += earnPerDay;

      if (open > 0 && dayFrac > 0) {
        const earned = earnPerDay * dayFrac;
        const served = visitsPerDay * open * dayFrac;
        buildings[b.instanceId] = {
          ...b,
          salesToday: (b.salesToday ?? 0) + earned,
          customersToday: (b.customersToday ?? 0) + served,
          salesLifetime: (b.salesLifetime ?? 0) + earned,
          customersLifetime: (b.customersLifetime ?? 0) + served,
        };
      }
    }
    const donationPerDay = dailyDonations(guestCount, avgHappiness, infoBoards);
    const foodPerDay = dailyAnimalCosts(animals);
    const wagePerDay = dailyStaffWages(staff);
    const upkeepPerDay = dailyUpkeep(buildings);

    const finances = applyOperatingDelta(s.finances, {
      ticketIncome: ticketEarned,
      shopIncome: shopPerDay * dayFrac,
      donationIncome: donationPerDay * dayFrac,
      animalCosts: foodPerDay * dayFrac,
      staffWages: wagePerDay * dayFrac,
      upkeep: upkeepPerDay * dayFrac,
    });

    set({
      tick,
      timeOfDay,
      animals,
      habitats,
      staff,
      guests,
      buildings,
      litter,
      deathNotices,
      selection,
      focusAnimalId,
      finances,
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
      // Ageing at day-roll; hunger already drained continuously through the day.
      const aged: Record<string, Animal> = {};
      for (const a of Object.values(s.animals)) {
        aged[a.id] = { ...a, age: a.age + 1 };
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
        buildings[id] = {
          ...b,
          condition: Math.max(0, b.condition - wear),
          salesToday: 0,
          customersToday: 0,
          // Lifetime totals persist across day rolls.
          salesLifetime: b.salesLifetime ?? 0,
          customersLifetime: b.customersLifetime ?? 0,
        };
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
        s.ownedParcels,
      );
      return { hoverCell, build: { ...s.build, valid } };
    }),

  /* ---- world mutations ---- */

  placeBuilding: (defId, cell, rotation = 0) => {
    const s = get();
    const def = getBuilding(defId);
    if (!def) return;
    if (!canPlaceBuilding(s.buildings, defId, cell, rotation, s.ownedParcels)) return;
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
    const building = s.buildings[instanceId];
    if (!building) return;
    // The entrance is permanent — tear down parking/amenities freely.
    if (building.defId === "entrance-arch") return;
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
      age: spawnAgeForLifespan(lifespanForSpecies(speciesId)),
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

  buyParcel: (key) => {
    const s = get();
    const offer = listBuyableParcels(s.ownedParcels).find((p) => p.key === key);
    if (!offer) return false;
    if (s.finances.cash < offer.cost) return false;
    if (s.ownedParcels.includes(key)) return false;
    const ownedParcels = [...s.ownedParcels, key];
    set({
      ownedParcels,
      plotSize: ownedExtent(ownedParcels).plotSize,
      finances: applyPurchase(s.finances, offer.cost),
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
  > & {
    ownedParcels?: string[];
    litter?: Record<string, Litter>;
  };
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
        ownedParcels: s.ownedParcels,
        habitats: s.habitats,
        animals: s.animals,
        guests: s.guests,
        staff: s.staff,
        buildings: s.buildings,
        litter: s.litter,
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
    const habitats = realignHabitatsToFences(parsed.state.habitats ?? {}, buildings);
    // Pull animals back inside realigned bounds if an old save left them outside.
    const animals: Record<string, Animal> = { ...(parsed.state.animals ?? {}) };
    for (const [id, a] of Object.entries(animals)) {
      let next = a;
      const life = a.lifespan > 0 ? a.lifespan : lifespanForSpecies(a.speciesId);
      // Older saves could spawn past lifespan — pull them back into a living age.
      if (a.age >= life) {
        next = {
          ...next,
          lifespan: life,
          age: Math.floor(life * 0.45),
        };
      } else if (a.lifespan !== life) {
        next = { ...next, lifespan: Math.max(life, a.age + 30) };
      }
      const h = next.habitatId ? habitats[next.habitatId] : undefined;
      if (h) {
        const pad = 0.85;
        const x = Math.min(h.bounds.max.x - pad, Math.max(h.bounds.min.x + pad, next.position.x));
        const z = Math.min(h.bounds.max.z - pad, Math.max(h.bounds.min.z + pad, next.position.z));
        if (x !== next.position.x || z !== next.position.z) {
          next = { ...next, position: { x, z } };
        }
      }
      animals[id] = next;
    }
    const ownedParcels =
      parsed.state.ownedParcels?.length
        ? parsed.state.ownedParcels
        : parcelsFromLegacyPlotSize(parsed.state.plotSize ?? START_PLOT_SIZE);
    const extent = ownedExtent(ownedParcels);

    // Older parks may lack a parking lot — seed one by the entrance if missing.
    let buildingsWithParking = buildings;
    const hasParking = Object.values(buildings).some((b) => b.defId === "parking-lot");
    if (!hasParking) {
      const arch = Object.values(buildings).find((b) => b.defId === "entrance-arch");
      if (arch) {
        const cell = {
          x: worldToCell(arch.position.x) - 6,
          z: worldToCell(arch.position.z) + 2,
        };
        const lot = makeBuilding("parking-lot", cell);
        buildingsWithParking = { ...buildings, [lot.instanceId]: lot };
      }
    }

    // Ensure trash bins have a fill level; seed litter empty for old saves.
    const buildingsNormalized: Record<string, Building> = {};
    for (const [id, b] of Object.entries(buildingsWithParking)) {
      buildingsNormalized[id] =
        b.defId === "trash-bin" && b.fillLevel == null ? { ...b, fillLevel: 0 } : b;
    }

    useGameStore.setState({
      ...parsed.state,
      buildings: buildingsNormalized,
      habitats,
      animals,
      ownedParcels,
      plotSize: extent.plotSize,
      litter: parsed.state.litter ?? {},
      guests: Object.fromEntries(
        Object.entries(parsed.state.guests ?? {}).map(([id, g]) => [id, migrateGuest(g, id)]),
      ),
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
