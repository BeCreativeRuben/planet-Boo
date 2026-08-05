/**
 * Wildhaven — buildable catalogue.
 *
 * Everything the player can place: habitat structure (fences, gates), scenery,
 * enrichment items, guest amenities and staff facilities. Sizes are whole grid
 * cells; colours drive the low-poly meshes in world/Buildings.tsx.
 */

import type { BuildingCategory, BuildingDef } from "./types";

export const BUILDINGS: BuildingDef[] = [
  /* --- Habitat structure ------------------------------------------------- */
  {
    id: "fence-segment",
    name: "Timber Fence",
    category: "habitat",
    cost: 45,
    size: [1, 1],
    color: "#7a5a34",
    icon: "🧱",
    description:
      "A one-metre run of sturdy timber fencing. Chain segments together to enclose a habitat.",
    upkeep: 0.05,
  },
  {
    id: "habitat-gate",
    name: "Keeper Gate",
    category: "habitat",
    cost: 220,
    size: [1, 1],
    color: "#5f4a2e",
    icon: "🚪",
    description:
      "A lockable gate that lets keepers enter an enclosure without breaking the fence line.",
    upkeep: 0.15,
  },

  /* --- Scenery ----------------------------------------------------------- */
  {
    id: "tree",
    name: "Shade Tree",
    category: "scenery",
    cost: 90,
    size: [1, 1],
    color: "#3f8f3a",
    icon: "🌳",
    description:
      "Leafy canopy that beautifies the park and gives animals and guests welcome shade.",
    upkeep: 0.2,
  },
  {
    id: "rock",
    name: "Boulder",
    category: "scenery",
    cost: 60,
    size: [1, 1],
    color: "#8b8579",
    icon: "🪨",
    description: "A faceted granite boulder. Great for naturalistic habitat backdrops.",
  },
  {
    id: "water-feature",
    name: "Water Feature",
    category: "scenery",
    cost: 320,
    size: [2, 2],
    color: "#3d7fa6",
    icon: "💧",
    description:
      "A pool of fresh water. Doubles as pool enrichment for animals that love to wallow or swim.",
    enrichment: "pool",
    upkeep: 1,
  },

  /* --- Enrichment -------------------------------------------------------- */
  {
    id: "enrichment-ball",
    name: "Boomer Ball",
    category: "enrichment",
    cost: 140,
    size: [1, 1],
    color: "#d4453b",
    icon: "🔴",
    description: "A tough rolling ball that keeps playful and predatory animals busy.",
    enrichment: "ball",
  },
  {
    id: "scratch-post",
    name: "Scent Post",
    category: "enrichment",
    cost: 120,
    size: [1, 1],
    color: "#8a6a3f",
    icon: "🪵",
    description: "A scent-marking post that encourages natural territorial behaviour.",
    enrichment: "scent",
  },
  {
    id: "climb-frame",
    name: "Climbing Frame",
    category: "enrichment",
    cost: 260,
    size: [2, 2],
    color: "#a06a34",
    icon: "🪜",
    description: "A lattice of ropes and beams for arboreal climbers to explore.",
    enrichment: "climb",
  },
  {
    id: "enrichment-pool",
    name: "Plunge Pool",
    category: "enrichment",
    cost: 380,
    size: [2, 2],
    color: "#2f8fb0",
    icon: "🏊",
    description: "A deep, chilled pool for swimmers to dive and cool off.",
    enrichment: "pool",
    upkeep: 1.2,
  },
  {
    id: "nest-box",
    name: "Nest Box",
    category: "enrichment",
    cost: 100,
    size: [1, 1],
    color: "#9c7b4a",
    icon: "🪺",
    description: "A cosy den box that offers shelter and encourages breeding.",
    enrichment: "nest",
  },

  /* --- Guest amenities --------------------------------------------------- */
  {
    id: "path",
    name: "Guest Path",
    category: "guest",
    cost: 12,
    size: [1, 1],
    color: "#c9bfa6",
    icon: "🛤️",
    description: "Paved walkway that guides guests around the park.",
  },
  {
    id: "bench",
    name: "Bench",
    category: "guest",
    cost: 80,
    size: [1, 1],
    color: "#9a7b4f",
    icon: "🪑",
    description: "A place to rest. Tired guests who can sit stay happier for longer.",
  },
  {
    id: "trash-bin",
    name: "Litter Bin",
    category: "guest",
    cost: 55,
    size: [1, 1],
    color: "#3f6d4a",
    icon: "🗑️",
    description:
      "Guests throw trash here when nearby. Fills up over time — hire janitors to empty bins and pick up overflow on paths.",
    upkeep: 0.2,
  },
  {
    id: "food-stall",
    name: "Food Stall",
    category: "guest",
    cost: 1800,
    size: [2, 2],
    color: "#c96f3a",
    icon: "🍔",
    description: "Sells hot food to hungry guests. A steady earner near busy paths.",
    revenuePerUse: 9,
    upkeep: 3,
  },
  {
    id: "drink-stall",
    name: "Drinks Kiosk",
    category: "guest",
    cost: 1500,
    size: [2, 2],
    color: "#2f9ea6",
    icon: "🥤",
    description: "Cold drinks for warm days. Guests visit often, so margins add up.",
    revenuePerUse: 6,
    upkeep: 2.5,
  },
  {
    id: "gift-shop",
    name: "Gift Shop",
    category: "guest",
    cost: 4200,
    size: [6, 6],
    color: "#c47a3a",
    icon: "🎁",
    description:
      "Sells souvenirs. Higher zoo appeal and happier guests dramatically increase sales.",
    revenuePerUse: 22,
    upkeep: 6,
  },
  {
    id: "toilet",
    name: "Restroom",
    category: "guest",
    cost: 1200,
    size: [2, 2],
    color: "#5b7d9a",
    icon: "🚻",
    description: "Essential facilities. Without them, guest happiness quickly sours.",
    upkeep: 2,
  },
  {
    id: "info-board",
    name: "Info Board",
    category: "guest",
    cost: 160,
    size: [1, 1],
    color: "#6d5a3a",
    icon: "🪧",
    description: "Educates guests about your animals, nudging donations upward.",
  },
  {
    id: "viewing-gallery",
    name: "Viewing Gallery",
    category: "guest",
    cost: 2600,
    size: [3, 2],
    color: "#b09070",
    icon: "🔭",
    description:
      "A raised deck beside a habitat that boosts how much guests enjoy the animals within.",
    upkeep: 3,
  },
  {
    id: "entrance-arch",
    name: "Entrance Arch",
    category: "guest",
    cost: 0,
    size: [6, 2],
    color: "#3d6a4f",
    icon: "🏛️",
    description:
      "The grand front gate where guests buy tickets. Open by day, closed at night — keep the parking lot maintained so crowds can arrive.",
    upkeep: 4,
  },
  {
    id: "parking-lot",
    name: "Parking Lot",
    category: "guest",
    cost: 4500,
    size: [12, 6],
    color: "#5a5e66",
    icon: "🅿️",
    description:
      "Visitor parking. Each lot adds stalls that raise guest capacity. Cars fill spaces nearest the entrance first across all lots. Mechanics keep asphalt patched.",
    upkeep: 18,
  },

  /* --- Staff facilities -------------------------------------------------- */
  {
    id: "keeper-hut",
    name: "Keeper Hut",
    category: "staff",
    cost: 1600,
    size: [2, 2],
    color: "#7a5a34",
    icon: "🛖",
    description: "A base for keepers. Nearby habitats are cleaned and fed more reliably.",
    upkeep: 2,
  },
  {
    id: "vet-clinic",
    name: "Veterinary Clinic",
    category: "staff",
    cost: 5200,
    size: [3, 3],
    color: "#c9d6cf",
    icon: "🏥",
    description: "Treats sick animals across the park, keeping health and welfare high.",
    upkeep: 5,
  },
];

/** Fast lookup by building id. */
export const BUILDINGS_BY_ID: Record<string, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
);

/** Look up a building definition by id (may be undefined). */
export function getBuilding(id: string): BuildingDef | undefined {
  return BUILDINGS_BY_ID[id];
}

/** All buildables in a category, in catalogue order. */
export function buildingsByCategory(category: BuildingCategory): BuildingDef[] {
  return BUILDINGS.filter((b) => b.category === category);
}
