/**
 * Wildhaven — demo park seed (UI-side, optional).
 *
 * The authoritative game store starts an empty park (just an entrance + path),
 * which is correct for real play but leaves the HUD with nothing to show until
 * the 3D scene lets the player build. To make the interface demonstrable on its
 * own, this injects a small, hand-authored park directly into the store — but
 * ONLY when the park is still empty. Once the real simulation has any habitats
 * or animals of its own, this is a no-op, so it never fights the parent's world.
 */

import type { Animal, Building, Guest, Habitat, Staff, StaffRole } from "../game/types";
import { computeWelfare } from "../game/welfare";
import { getStaffRole } from "../game/staffTypes";
import { getBuilding } from "../game/buildings";
import { newLedgerDay } from "../game/economy";
import { footprintCenter, spawnGuest, worldToCell } from "../game/simulation";
import { lifespanForSpecies } from "../game/care";
import { useGameStore } from "./gameStore";

let seq = 0;
const uid = (p: string) => `demo-${p}-${++seq}`;

function makeHabitat(
  p: Pick<Habitat, "name" | "biome"> & Partial<Habitat> & { cx: number; cz: number },
): Habitat {
  const { cx, cz, ...rest } = p;
  const half = 12;
  return {
    id: uid("hab"),
    speciesId: undefined,
    bounds: { min: { x: cx - half, z: cz - half }, max: { x: cx + half, z: cz + half } },
    area: 1200,
    fenced: true,
    temperature: 26,
    humidity: 45,
    hygiene: 84,
    enrichmentProvided: [],
    animalIds: [],
    buildingIds: [],
    ...rest,
  } as Habitat;
}

function makeAnimal(
  speciesId: string,
  name: string,
  habitat: Habitat,
  overrides: Partial<Animal> = {},
): Animal {
  const cx = (habitat.bounds.min.x + habitat.bounds.max.x) / 2;
  const cz = (habitat.bounds.min.z + habitat.bounds.max.z) / 2;
  return {
    id: uid("a"),
    speciesId,
    name,
    habitatId: habitat.id,
    position: { x: cx + (Math.random() - 0.5) * 6, z: cz + (Math.random() - 0.5) * 6 },
    age: 200 + Math.floor(Math.random() * 400),
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

function makeBuilding(defId: string, x: number, z: number, rotation = 0): Building {
  const def = getBuilding(defId);
  const cell = { x: worldToCell(x), z: worldToCell(z) };
  return {
    instanceId: uid("b"),
    defId,
    category: def?.category ?? "scenery",
    position: footprintCenter(cell, def, rotation),
    rotation,
    condition: 86 + Math.floor(Math.random() * 12),
  };
}

/** Populate an empty park with a lively demo. Returns true if it seeded. */
export function seedDemoParkIfEmpty(): boolean {
  const s = useGameStore.getState();
  if (Object.keys(s.habitats).length > 0 || Object.keys(s.animals).length > 0) {
    return false;
  }

  const habitats: Record<string, Habitat> = {};
  const animals: Record<string, Animal> = {};
  const staff: Record<string, Staff> = {};

  const place = (h: Habitat) => {
    habitats[h.id] = h;
    return h;
  };
  const spawn = (a: Animal) => {
    animals[a.id] = a;
    habitats[a.habitatId!].animalIds.push(a.id);
    return a;
  };

  // Thriving lion pride.
  const savanna = place(
    makeHabitat({
      name: "Sunset Savanna",
      biome: "savanna",
      cx: -18,
      cz: -6,
      area: 1400,
      temperature: 29,
      humidity: 38,
      hygiene: 88,
      speciesId: "lion",
      enrichmentProvided: ["scent", "log", "ball"],
    }),
  );
  spawn(makeAnimal("lion", "Amara", savanna, { sex: "female" }));
  spawn(makeAnimal("lion", "Jabari", savanna, { sex: "male" }));

  // Giraffe browse.
  const ridge = place(
    makeHabitat({
      name: "Acacia Ridge",
      biome: "savanna",
      cx: 16,
      cz: -10,
      area: 2100,
      temperature: 30,
      humidity: 35,
      hygiene: 80,
      speciesId: "giraffe",
      enrichmentProvided: ["log", "scent"],
    }),
  );
  spawn(makeAnimal("giraffe", "Zuri", ridge));
  spawn(makeAnimal("giraffe", "Kito", ridge));
  spawn(makeAnimal("giraffe", "Nia", ridge));

  // Distressed flamingos (intentional welfare problem to surface in the HUD).
  const lagoon = place(
    makeHabitat({
      name: "Mirror Lagoon",
      biome: "wetland",
      cx: -14,
      cz: 16,
      area: 600,
      temperature: 24,
      humidity: 70,
      hygiene: 58,
      speciesId: "flamingo",
      enrichmentProvided: ["pool"],
    }),
  );
  spawn(makeAnimal("flamingo", "Rosa", lagoon, { welfare: 42, hunger: 33 }));
  spawn(makeAnimal("flamingo", "Coral", lagoon, { welfare: 40, hunger: 30, health: 68 }));

  // Content solitary tiger.
  const glade = place(
    makeHabitat({
      name: "Fern Glade",
      biome: "forest",
      cx: 18,
      cz: 16,
      area: 520,
      temperature: 24,
      humidity: 68,
      hygiene: 83,
      speciesId: "tiger",
      enrichmentProvided: ["pool", "scent", "log", "ball"],
    }),
  );
  spawn(makeAnimal("tiger", "Rajah", glade));

  // Recompute each animal's welfare from its habitat so HUD + panel agree.
  for (const a of Object.values(animals)) {
    const h = habitats[a.habitatId!];
    let herd = 0;
    for (const id of h.animalIds) if (animals[id]?.speciesId === a.speciesId) herd++;
    a.welfare = computeWelfare(a, h, Math.max(1, herd)).score;
  }

  (["keeper", "keeper", "vet", "vendor"] as StaffRole[]).forEach((r, i) => {
    const m = makeStaff(r, i);
    staff[m.id] = m;
  });

  // Seed a lively crowd along the main path so the park feels populated.
  const guests: Record<string, Guest> = {};
  for (let i = 0; i < 36; i++) {
    const g = spawnGuest(uid("g"), i, { x: (Math.random() - 0.5) * 8, z: 8 + Math.random() * 18 });
    g.happiness = 60 + Math.random() * 35;
    guests[g.id] = g;
  }

  // A few revenue amenities so the finance panel has substance.
  const extraBuildings: Record<string, Building> = {};
  const addB = (defId: string, x: number, z: number) => {
    const b = makeBuilding(defId, x, z);
    extraBuildings[b.instanceId] = b;
  };
  [
    ["food-stall", 2, 6],
    ["drink-stall", -3, 6],
    ["gift-shop", 5, 8],
    ["toilet", -6, 8],
    ["bench", 0, 4],
    ["info-board", 1, 10],
    ["viewing-gallery", -18, 4],
    ["viewing-gallery", 16, 0],
    ["keeper-hut", 0, 14],
  ].forEach(([id, x, z]) => addB(id as string, x as number, z as number));

  // Fence rings + scenery so the 3D park reads as enclosures, not floating animals.
  // Rotation 0 = east–west run (N/S edges); 1 = north–south run (E/W edges).
  const addBRot = (defId: string, x: number, z: number, rotation: number) => {
    const b = makeBuilding(defId, x, z, rotation);
    extraBuildings[b.instanceId] = b;
  };
  const ringFence = (cx: number, cz: number, half: number) => {
    for (let x = cx - half; x <= cx + half; x++) {
      addBRot("fence-segment", x, cz - half, 0);
      // Leave a gap on the north edge for the keeper gate.
      if (x !== cx) addBRot("fence-segment", x, cz + half, 0);
    }
    for (let z = cz - half + 1; z < cz + half; z++) {
      addBRot("fence-segment", cx - half, z, 1);
      addBRot("fence-segment", cx + half, z, 1);
    }
    addBRot("habitat-gate", cx, cz + half, 0);
  };
  ringFence(-18, -6, 10);
  ringFence(16, -10, 11);
  ringFence(-14, 16, 8);
  ringFence(18, 16, 8);

  // Trees & rocks sprinkled around habitats.
  const decor: Array<[string, number, number]> = [
    ["tree", -28, -2], ["tree", -26, -14], ["tree", -8, -16], ["tree", 6, -18],
    ["tree", 28, -4], ["tree", 26, -18], ["tree", -24, 20], ["tree", 8, 22],
    ["tree", 28, 20], ["tree", -4, -22], ["rock", -12, -14], ["rock", 10, -4],
    ["rock", 22, 10], ["water-feature", -14, 16], ["enrichment-ball", -18, -6],
    ["scratch-post", 16, -8], ["enrichment-pool", 18, 16], ["climb-frame", 18, 14],
  ];
  for (const [id, x, z] of decor) addB(id, x, z);

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
        ticketIncome: 3980,
        shopIncome: 1624,
        donationIncome: 21,
        animalCosts: 592,
        staffWages: 400,
        upkeep: 138,
        capitalSpend: 0,
      },
      history: [
        { day: 1, ticketIncome: 1200, shopIncome: 300, donationIncome: 0, animalCosts: 200, staffWages: 250, upkeep: 60, capitalSpend: 0 },
        { day: 2, ticketIncome: 1850, shopIncome: 520, donationIncome: 3, animalCosts: 300, staffWages: 320, upkeep: 80, capitalSpend: 0 },
        { day: 3, ticketIncome: 2400, shopIncome: 780, donationIncome: 8, animalCosts: 420, staffWages: 400, upkeep: 100, capitalSpend: 0 },
        { day: 4, ticketIncome: 2100, shopIncome: 900, donationIncome: 12, animalCosts: 520, staffWages: 400, upkeep: 120, capitalSpend: 0 },
        { day: 5, ticketIncome: 3300, shopIncome: 1400, donationIncome: 18, animalCosts: 560, staffWages: 400, upkeep: 130, capitalSpend: 0 },
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
