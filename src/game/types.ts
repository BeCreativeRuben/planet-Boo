/**
 * Wildhaven — shared domain types.
 *
 * Every module in the game (data tables, pure simulation helpers, the Zustand
 * store, the R3F world and the HUD) speaks these types. They are intentionally
 * plain data — no classes, no methods — so state stays trivially serialisable
 * for saves and cheap to clone inside the store.
 */

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                  */
/* -------------------------------------------------------------------------- */

/** A point on the park's ground plane (metres, world space, y implied 0). */
export interface Vec2 {
  x: number;
  z: number;
}

/** An axis-aligned rectangle in world space. */
export interface Bounds {
  min: Vec2;
  max: Vec2;
}

/* -------------------------------------------------------------------------- */
/*  Enumerations                                                              */
/* -------------------------------------------------------------------------- */

export type Biome =
  | "savanna"
  | "forest"
  | "wetland"
  | "desert"
  | "arctic"
  | "mountain";

export type AnimalSizeClass = "small" | "medium" | "large" | "huge";

export type Diet = "herbivore" | "carnivore" | "omnivore";

/** IUCN-style conservation status (abbreviated). */
export type ConservationStatus =
  | "LC" // Least Concern
  | "NT" // Near Threatened
  | "VU" // Vulnerable
  | "EN" // Endangered
  | "CR" // Critically Endangered
  | "EW"; // Extinct in the Wild

/** The kinds of enrichment an animal can need / a habitat can provide. */
export type EnrichmentType =
  | "ball"
  | "scent"
  | "log"
  | "pool"
  | "climb"
  | "nest";

export type Sex = "male" | "female";

export type BuildingCategory =
  | "habitat"
  | "enrichment"
  | "guest"
  | "staff"
  | "scenery";

export type StaffRole = "keeper" | "vendor" | "vet" | "mechanic";

/* -------------------------------------------------------------------------- */
/*  Static data definitions                                                   */
/* -------------------------------------------------------------------------- */

export interface SpeciesDef {
  id: string;
  name: string;
  scientificName: string;
  biome: Biome;
  /** Emoji fallback for the HUD. */
  icon: string;
  /** Hex colour used to tint the 3D mesh. */
  color: string;
  size: AnimalSizeClass;
  /** Adoption cost. */
  cost: number;
  /** How much guests enjoy seeing this species (park appeal). */
  appeal: number;
  /** Space each individual needs, in square metres. */
  spaceNeeded: number;
  /** Comfortable temperature band [min, max] in °C. */
  preferredTemp: [number, number];
  /** Comfortable relative humidity band [min, max] in %. */
  preferredHumidity: [number, number];
  /** Smallest healthy social group. */
  socialMin: number;
  /** Largest healthy social group before crowding. */
  socialMax: number;
  enrichmentNeeds: EnrichmentType[];
  diet: Diet;
  foodCostPerDay: number;
  description: string;
  conservationStatus: ConservationStatus;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  cost: number;
  /** Footprint in whole grid cells [width, depth]. */
  size: [number, number];
  /** Hex colour for the 3D mesh. */
  color: string;
  description: string;
  /** Enrichment tag contributed to the enclosing habitat, if any. */
  enrichment?: EnrichmentType;
  /** Revenue amenities (shops, stalls) earn this much per guest transaction. */
  revenuePerUse?: number;
  /** Daily upkeep cost while placed. */
  upkeep?: number;
  /** Emoji used in the build toolbar. */
  icon?: string;
}

export interface StaffRoleDef {
  role: StaffRole;
  name: string;
  icon: string;
  color: string;
  /** Daily wage. */
  wage: number;
  /** One-off hiring cost. */
  hireCost: number;
  description: string;
}

/* -------------------------------------------------------------------------- */
/*  Live entities                                                             */
/* -------------------------------------------------------------------------- */

export interface Animal {
  id: string;
  speciesId: string;
  name: string;
  /** Habitat the animal belongs to (undefined while unplaced). */
  habitatId?: string;
  position: Vec2;
  /** Age in in-game days. */
  age: number;
  /** Expected lifespan in in-game days. */
  lifespan: number;
  sex: Sex;
  /** 0..100 */
  health: number;
  /** 0..100 (100 = fully fed). */
  hunger: number;
  /** 0..100 composite welfare score. */
  welfare: number;
  sick: boolean;
  /** Days until the animal can breed again. */
  breedCooldown: number;
}

export interface Habitat {
  id: string;
  name: string;
  biome: Biome;
  /** Dominant species assigned to the enclosure, if any. */
  speciesId?: string;
  bounds: Bounds;
  /** Interior area in square metres. */
  area: number;
  fenced: boolean;
  /** °C */
  temperature: number;
  /** % relative humidity */
  humidity: number;
  /** 0..100 cleanliness */
  hygiene: number;
  enrichmentProvided: EnrichmentType[];
  animalIds: string[];
  buildingIds: string[];
}

export interface Guest {
  id: string;
  position: Vec2;
  /** Current waypoint the guest is walking toward. */
  target: Vec2 | null;
  /** 0..100 */
  happiness: number;
  /** How much money the guest still intends to spend. */
  wallet: number;
  /** Seconds of park time remaining before the guest leaves. */
  patience: number;
}

export interface Staff {
  id: string;
  role: StaffRole;
  name: string;
  position: Vec2;
  /** 0..100 */
  energy: number;
  /** Habitat / building ids this staffer tends. */
  assignments: string[];
  targetId?: string;
}

export interface Building {
  instanceId: string;
  defId: string;
  category: BuildingCategory;
  /** World-space centre of the footprint. */
  position: Vec2;
  /** Quarter turns (0..3). */
  rotation: number;
  /** Habitat this piece belongs to, if any. */
  habitatId?: string;
  /** 0..100 structural condition. */
  condition: number;
  /** Revenue earned today (shops / stalls only). */
  salesToday?: number;
  /** Guest transactions served today (shops / stalls only). */
  customersToday?: number;
}

/* -------------------------------------------------------------------------- */
/*  Economy                                                                   */
/* -------------------------------------------------------------------------- */

/** A single day's income / expense ledger. */
export interface LedgerDay {
  day: number;
  ticketIncome: number;
  shopIncome: number;
  donationIncome: number;
  animalCosts: number;
  staffWages: number;
  upkeep: number;
  /** One-off capital spend (adoptions, construction). */
  capitalSpend: number;
}

export interface Finances {
  cash: number;
  conservationPoints: number;
  /** Price of a single guest ticket. */
  ticketPrice: number;
  /** The day currently being accumulated. */
  today: LedgerDay;
  /** Settled previous days (most recent last). */
  history: LedgerDay[];
}

/* -------------------------------------------------------------------------- */
/*  Build tooling                                                             */
/* -------------------------------------------------------------------------- */

export type BuildTool =
  | "none"
  | "place"
  | "fence"
  | "gate"
  | "animal"
  | "claim"
  | "delete";

export interface BuildMode {
  active: boolean;
  tool: BuildTool;
  selectedDefId?: string;
  selectedSpeciesId?: string;
  /** Quarter turns (0..3). */
  rotation: number;
  gridSize: number;
  /** Whether the current hovered placement is legal. */
  valid: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Aggregate game state                                                      */
/* -------------------------------------------------------------------------- */

export interface ParkStats {
  guestCount: number;
  averageGuestHappiness: number;
  averageAnimalWelfare: number;
  /** 0..5 star rating. */
  rating: number;
}

export interface GameState {
  /** Monotonic simulation tick counter. */
  tick: number;
  day: number;
  /** 0..1 fraction of the day elapsed (0 = midnight). */
  timeOfDay: number;
  /** Ambient park temperature in °C. */
  ambientTemp: number;
  /** Simulation speed multiplier (1 | 2 | 3). */
  speed: number;

  finances: Finances;

  /**
   * Owned land as parcel keys `"px,pz"` (see game/parcels.ts).
   * Expand by buying adjacent parcels in any direction.
   */
  ownedParcels: string[];

  /**
   * @deprecated Derived square edge for older UI; prefer ownedExtent(ownedParcels).
   * Kept in saves for migration and as a rough camera extent.
   */
  plotSize: number;

  habitats: Record<string, Habitat>;
  animals: Record<string, Animal>;
  guests: Record<string, Guest>;
  staff: Record<string, Staff>;
  buildings: Record<string, Building>;

  unlockedSpecies: string[];

  build: BuildMode;
  stats: ParkStats;
}

/* -------------------------------------------------------------------------- */
/*  Welfare                                                                   */
/* -------------------------------------------------------------------------- */

export interface WelfareFactor {
  key: string;
  label: string;
  /** 0..100 */
  value: number;
}

export interface WelfareResult {
  /** 0..100 overall welfare. */
  score: number;
  factors: WelfareFactor[];
}
