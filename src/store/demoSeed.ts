/**
 * Wildhaven — demo park seed (UI-side, optional).
 *
 * Injects a hand-authored park when the store is still empty. Habitats are
 * derived from the same fence flood-fill as Claim Habitat, so rings, highlights,
 * and animal confinement share one geometry.
 */

import type { Animal, Biome, Building, Guest, Habitat, Staff, StaffRole } from "../game/types";
import { computeWelfare } from "../game/welfare";
import { getStaffRole } from "../game/staffTypes";
import { getBuilding } from "../game/buildings";
import { newLedgerDay } from "../game/economy";
import {
  collectFenceCells,
  floodFillEnclosure,
  footprintCenter,
  spawnGuest,
  worldToCell,
} from "../game/simulation";
import { lifespanForSpecies, spawnAgeForLifespan } from "../game/care";
import { useGameStore } from "./gameStore";

let seq = 0;
const uid = (p: string) => `demo-${p}-${++seq}`;

interface EnclosurePlan {
  name: string;
  biome: Biome;
  /** Approximate world centre — snapped to a grid cell for the fence ring. */
  cx: number;
  cz: number;
  /** Fence half-width in cells (ring edge distance from centre cell). */
  half: number;
  temperature: number;
  humidity: number;
  hygiene: number;
  speciesId: string;
  enrichmentProvided: Habitat["enrichmentProvided"];
}

const ENCLOSURES: EnclosurePlan[] = [
  {
    name: "Sunset Savanna",
    biome: "savanna",
    cx: -18,
    cz: -6,
    half: 10,
    temperature: 29,
    humidity: 38,
    hygiene: 88,
    speciesId: "lion",
    enrichmentProvided: ["scent", "log", "ball"],
  },
  {
    name: "Acacia Ridge",
    biome: "savanna",
    cx: 16,
    cz: -10,
    half: 11,
    temperature: 30,
    humidity: 35,
    hygiene: 80,
    speciesId: "giraffe",
    enrichmentProvided: ["log", "scent"],
  },
  {
    name: "Mirror Lagoon",
    biome: "wetland",
    cx: -14,
    cz: 16,
    half: 8,
    temperature: 24,
    humidity: 70,
    hygiene: 58,
    speciesId: "flamingo",
    enrichmentProvided: ["pool"],
  },
  {
    name: "Fern Glade",
    biome: "forest",
    cx: 18,
    cz: 16,
    half: 8,
    temperature: 24,
    humidity: 68,
    hygiene: 83,
    speciesId: "tiger",
    enrichmentProvided: ["pool", "scent", "log", "ball"],
  },
];

function makeAnimal(
  speciesId: string,
  name: string,
  habitat: Habitat,
  overrides: Partial<Animal> = {},
): Animal {
  const cx = (habitat.bounds.min.x + habitat.bounds.max.x) / 2;
  const cz = (habitat.bounds.min.z + habitat.bounds.max.z) / 2;
  const spanX = Math.max(2, habitat.bounds.max.x - habitat.bounds.min.x - 2.4);
  const spanZ = Math.max(2, habitat.bounds.max.z - habitat.bounds.min.z - 2.4);
  const jitter = Math.min(4, Math.min(spanX, spanZ) * 0.35);
  return {
    id: uid("a"),
    speciesId,
    name,
    habitatId: habitat.id,
    position: {
      x: cx + (Math.random() - 0.5) * jitter,
      z: cz + (Math.random() - 0.5) * jitter,
    },
    age: spawnAgeForLifespan(lifespanForSpecies(speciesId)),
    lifespan: lifespanForSpecies(speciesId),
    sex: Math.random() < 0.5 ? "male" : "female",
    health: 92,
    hunger: 78,
    welfare: 80,
    sick: false,
    breedCooldown: 0,
    ...overrides,
  };
}

function makeStaff(role: StaffRole, i: number): Staff {
  const def = getStaffRole(role);
  return {
    id: uid("s"),
    role,
    name: `${def.name} ${i + 1}`,
    position: { x: 0, z: 0 },
    energy: 82 + Math.floor(Math.random() * 15),
    assignments: [],
    targetId: undefined,
  };
}

/** Place a building by grid cell (same path as player-built pieces). */
function makeBuildingAtCell(
  defId: string,
  cellX: number,
  cellZ: number,
  rotation = 0,
): Building {
  const def = getBuilding(defId);
  const cell = { x: cellX, z: cellZ };
  return {
    instanceId: uid("b"),
    defId,
    category: def?.category ?? "scenery",
    position: footprintCenter(cell, def, rotation),
    rotation,
    condition: 86 + Math.floor(Math.random() * 12),
    salesToday: 0,
    customersToday: 0,
  };
}

function makeBuildingAtWorld(defId: string, x: number, z: number, rotation = 0): Building {
  return makeBuildingAtCell(defId, worldToCell(x), worldToCell(z), rotation);
}

/** Populate an empty park with a lively demo. Returns true if it seeded. */
export function seedDemoParkIfEmpty(): boolean {
  const s = useGameStore.getState();
  if (Object.keys(s.habitats).length > 0 || Object.keys(s.animals).length > 0) {
    return false;
  }

  const extraBuildings: Record<string, Building> = {};
  const addCell = (defId: string, cx: number, cz: number, rotation = 0) => {
    const b = makeBuildingAtCell(defId, cx, cz, rotation);
    extraBuildings[b.instanceId] = b;
    return b;
  };
  const addWorld = (defId: string, x: number, z: number, rotation = 0) => {
    const b = makeBuildingAtWorld(defId, x, z, rotation);
    extraBuildings[b.instanceId] = b;
    return b;
  };

  // Guest amenities on the central path — kept outside enclosure interiors.
  (
    [
      ["food-stall", 2, 6],
      ["drink-stall", -3, 6],
      ["gift-shop", 5, 8],
      ["toilet", -6, 8],
      ["bench", 0, 4],
      ["info-board", 1, 10],
      ["keeper-hut", 0, 14],
    ] as Array<[string, number, number]>
  ).forEach(([id, x, z]) => addWorld(id, x, z));

  // Fence rings in cell space around each enclosure centre.
  const seeds: Array<{ plan: EnclosurePlan; seed: { x: number; z: number } }> = [];
  for (const plan of ENCLOSURES) {
    const seed = { x: worldToCell(plan.cx), z: worldToCell(plan.cz) };
    const { half } = plan;
    for (let x = seed.x - half; x <= seed.x + half; x++) {
      addCell("fence-segment", x, seed.z - half, 0);
      if (x !== seed.x) addCell("fence-segment", x, seed.z + half, 0);
    }
    for (let z = seed.z - half + 1; z < seed.z + half; z++) {
      addCell("fence-segment", seed.x - half, z, 1);
      addCell("fence-segment", seed.x + half, z, 1);
    }
    addCell("habitat-gate", seed.x, seed.z + half, 0);
    // Viewing gallery just outside the north gate so guests never path inside.
    addCell("viewing-gallery", seed.x, seed.z + half + 2, 0);
    seeds.push({ plan, seed });
  }

  // Scenery / enrichment — snapped to cells; interior pieces sit inside rings.
  const decor: Array<[string, number, number]> = [
    ["tree", -28, -2],
    ["tree", -26, -14],
    ["tree", -8, -16],
    ["tree", 6, -18],
    ["tree", 28, -4],
    ["tree", 26, -18],
    ["tree", -24, 20],
    ["tree", 8, 22],
    ["tree", 28, 20],
    ["tree", -4, -22],
    ["rock", -12, -14],
    ["rock", 10, -4],
    ["rock", 22, 10],
    ["water-feature", -14, 16],
    ["enrichment-ball", -18, -6],
    ["scratch-post", 16, -8],
    ["enrichment-pool", 18, 16],
    ["climb-frame", 18, 14],
  ];
  for (const [id, x, z] of decor) addWorld(id, x, z);

  // Habitats from flood-fill — same geometry as Claim Habitat.
  const fenceCells = collectFenceCells(extraBuildings);
  const habitats: Record<string, Habitat> = {};
  const animals: Record<string, Animal> = {};

  const animalSpawns: Array<{
    habitatName: string;
    speciesId: string;
    name: string;
    overrides?: Partial<Animal>;
  }> = [
    { habitatName: "Sunset Savanna", speciesId: "lion", name: "Amara", overrides: { sex: "female" } },
    { habitatName: "Sunset Savanna", speciesId: "lion", name: "Jabari", overrides: { sex: "male" } },
    { habitatName: "Acacia Ridge", speciesId: "giraffe", name: "Zuri" },
    { habitatName: "Acacia Ridge", speciesId: "giraffe", name: "Kito" },
    { habitatName: "Acacia Ridge", speciesId: "giraffe", name: "Nia" },
    {
      habitatName: "Mirror Lagoon",
      speciesId: "flamingo",
      name: "Rosa",
      overrides: { welfare: 42, hunger: 48 },
    },
    {
      habitatName: "Mirror Lagoon",
      speciesId: "flamingo",
      name: "Coral",
      overrides: { welfare: 40, hunger: 44, health: 78 },
    },
    { habitatName: "Fern Glade", speciesId: "tiger", name: "Rajah" },
  ];

  for (const { plan, seed } of seeds) {
    const enclosure = floodFillEnclosure(seed, fenceCells);
    let bounds = enclosure.bounds;
    let areaCells = enclosure.cells.size;
    if (!enclosure.bounded || enclosure.cells.size < 4) {
      // Fallback should never fire for a closed ring; keep a tight AABB if it does.
      const halfW = plan.half - 0.5;
      bounds = {
        min: { x: plan.cx - halfW, z: plan.cz - halfW },
        max: { x: plan.cx + halfW, z: plan.cz + halfW },
      };
      areaCells = Math.round((halfW * 2) ** 2);
    }
    const w = bounds.max.x - bounds.min.x;
    const d = bounds.max.z - bounds.min.z;
    const id = uid("hab");
    habitats[id] = {
      id,
      name: plan.name,
      biome: plan.biome,
      speciesId: plan.speciesId,
      bounds,
      area: Math.max(1, areaCells || Math.round(w * d)),
      fenced: true,
      temperature: plan.temperature,
      humidity: plan.humidity,
      hygiene: plan.hygiene,
      enrichmentProvided: [...plan.enrichmentProvided],
      animalIds: [],
      buildingIds: [],
    };
  }

  const habitatByName = Object.fromEntries(
    Object.values(habitats).map((h) => [h.name, h]),
  ) as Record<string, Habitat>;

  for (const spawn of animalSpawns) {
    const habitat = habitatByName[spawn.habitatName];
    if (!habitat) continue;
    const a = makeAnimal(spawn.speciesId, spawn.name, habitat, spawn.overrides);
    animals[a.id] = a;
    habitat.animalIds.push(a.id);
  }

  for (const a of Object.values(animals)) {
    const h = habitats[a.habitatId!];
    let herd = 0;
    for (const id of h.animalIds) if (animals[id]?.speciesId === a.speciesId) herd++;
    a.welfare = computeWelfare(a, h, Math.max(1, herd)).score;
  }

  const staff: Record<string, Staff> = {};
  (["keeper", "keeper", "vet", "vendor"] as StaffRole[]).forEach((r, i) => {
    const m = makeStaff(r, i);
    staff[m.id] = m;
  });

  // Guests along the open central path (south of the park centre).
  const guests: Record<string, Guest> = {};
  for (let i = 0; i < 36; i++) {
    const g = spawnGuest(uid("g"), i, {
      x: (Math.random() - 0.5) * 8,
      z: 8 + Math.random() * 12,
    });
    g.happiness = 60 + Math.random() * 35;
    guests[g.id] = g;
  }

  const welfares = Object.values(animals).map((a) => a.welfare);
  const avgWelfare = Math.round(welfares.reduce((n, w) => n + w, 0) / welfares.length);

  useGameStore.setState((prev) => ({
    habitats,
    animals,
    staff,
    guests,
    buildings: { ...prev.buildings, ...extraBuildings },
    day: 6,
    timeOfDay: 0.62,
    finances: {
      ...prev.finances,
      cash: 68_450,
      conservationPoints: 145,
      today: {
        ...newLedgerDay(6),
        ticketIncome: 3980 * 0.62,
        shopIncome: 1624 * 0.62,
        donationIncome: 21 * 0.62,
        animalCosts: 661 * 0.62,
        staffWages: 510 * 0.62,
        upkeep: 45 * 0.62,
        capitalSpend: 0,
      },
      history: [
        {
          day: 1,
          ticketIncome: 1200,
          shopIncome: 300,
          donationIncome: 0,
          animalCosts: 200,
          staffWages: 250,
          upkeep: 60,
          capitalSpend: 0,
        },
        {
          day: 2,
          ticketIncome: 1850,
          shopIncome: 520,
          donationIncome: 3,
          animalCosts: 300,
          staffWages: 320,
          upkeep: 80,
          capitalSpend: 0,
        },
        {
          day: 3,
          ticketIncome: 2400,
          shopIncome: 780,
          donationIncome: 8,
          animalCosts: 420,
          staffWages: 400,
          upkeep: 100,
          capitalSpend: 0,
        },
        {
          day: 4,
          ticketIncome: 2100,
          shopIncome: 900,
          donationIncome: 12,
          animalCosts: 520,
          staffWages: 400,
          upkeep: 120,
          capitalSpend: 0,
        },
        {
          day: 5,
          ticketIncome: 3300,
          shopIncome: 1400,
          donationIncome: 18,
          animalCosts: 560,
          staffWages: 400,
          upkeep: 130,
          capitalSpend: 0,
        },
      ],
    },
    stats: {
      guestCount: Object.keys(guests).length,
      averageGuestHappiness: 76,
      averageAnimalWelfare: avgWelfare,
      rating: 3.6,
    },
  }));

  return true;
}
