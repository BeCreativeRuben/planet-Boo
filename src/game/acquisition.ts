/**
 * Wildhaven — animal acquisition & rarity.
 *
 * Animals can arrive through purchases, shelter intakes, wild rescues, spotted
 * sightings, retired-zoo lots, and similar offers that rotate over time.
 */

import { SPECIES, SPECIES_BY_ID } from "./species";
import type {
  AcquisitionMethod,
  AcquisitionOffer,
  AnimalRarity,
  Finances,
  Habitat,
  SpeciesDef,
} from "./types";

export const MAX_ACTIVE_OFFERS = 6;

export const METHOD_META: Record<
  AcquisitionMethod,
  { label: string; icon: string; verb: string; hint: string }
> = {
  buy: {
    label: "Purchase",
    icon: "🏷️",
    verb: "Buy",
    hint: "Standard catalog price from a licensed breeder.",
  },
  adopt: {
    label: "Adopt",
    icon: "🤝",
    verb: "Adopt",
    hint: "Low-cost placement — guests love a rescue story.",
  },
  rescue_wild: {
    label: "Wild rescue",
    icon: "🚑",
    verb: "Rescue",
    hint: "Injured or orphaned in the wild — needs vet care.",
  },
  spotted: {
    label: "Spotted nearby",
    icon: "👀",
    verb: "Collect",
    hint: "A rare sighting — act before the window closes.",
  },
  deprecated_zoo: {
    label: "Retired zoo",
    icon: "🏚️",
    verb: "Rehome",
    hint: "Another facility is closing — discounted but stressed.",
  },
  shelter: {
    label: "Shelter intake",
    icon: "🏠",
    verb: "Shelter",
    hint: "Waiting for a home — often common species, low fees.",
  },
  sanctuary_transfer: {
    label: "Sanctuary partner",
    icon: "🌿",
    verb: "Transfer",
    hint: "Overflow from a partner sanctuary — conservation points help.",
  },
};

export const RARITY_META: Record<
  AnimalRarity,
  { label: string; appealMult: number; color: string }
> = {
  common: { label: "Common", appealMult: 1, color: "#9aa89a" },
  uncommon: { label: "Uncommon", appealMult: 1.08, color: "#5fc07a" },
  rare: { label: "Rare", appealMult: 1.18, color: "#6fb0d6" },
  legendary: { label: "Legendary", appealMult: 1.32, color: "#e7b84a" },
};

const RESCUE_FLAVOR = [
  "Orphaned after a brushfire",
  "Stranded by seasonal flooding",
  "Injured near a village road",
  "Separated from its herd",
  "Caught in a snare — now recovering",
];

const SPOTTED_FLAVOR = [
  "Camera-trap sighting on park land",
  "Ranger reported nearby",
  "Unusual visitor on the boundary",
  "Tracked crossing the river",
];

const ZOO_FLAVOR = [
  "Closing-down auction lot",
  "Retired circus stock",
  "Municipal zoo downsizing",
  "Private collection dispersal",
];

const SHELTER_FLAVOR = [
  "Needs a forever home",
  "Seized from illegal trade",
  "Hand-reared release candidate",
  "Overflow from regional shelter",
];

const ADOPT_FLAVOR = [
  "Former education ambassador",
  "Pet surrender — needs space",
  "Non-releasable wild orphan",
];

const SANCTUARY_FLAVOR = [
  "Partner sanctuary overflow",
  "Confiscation transfer",
  "Breeding-program retiree",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Gameplay rarity derived from conservation + price tier. */
export function speciesRarity(def: SpeciesDef): AnimalRarity {
  if (def.rarity) return def.rarity;
  if (def.conservationStatus === "CR" || def.conservationStatus === "EW" || def.cost >= 20_000) {
    return "legendary";
  }
  if (def.conservationStatus === "EN" || def.cost >= 11_000) return "rare";
  if (def.conservationStatus === "VU" || def.cost >= 6_500) return "uncommon";
  return "common";
}

export function effectiveRarity(def: SpeciesDef, override?: AnimalRarity): AnimalRarity {
  return override ?? speciesRarity(def);
}

export function buyPrice(def: SpeciesDef): number {
  return def.cost;
}

export function offerCashCost(def: SpeciesDef, method: AcquisitionMethod): number {
  switch (method) {
    case "buy":
      return def.cost;
    case "adopt":
      return Math.round(def.cost * 0.15);
    case "rescue_wild":
      return Math.round(def.cost * 0.22 + 800);
    case "spotted":
      return Math.round(def.cost * 1.12);
    case "deprecated_zoo":
      return Math.round(def.cost * 0.48);
    case "shelter":
      return Math.max(0, Math.round(def.cost * 0.08));
    case "sanctuary_transfer":
      return Math.round(def.cost * 0.35);
    default:
      return def.cost;
  }
}

export function offerConservationCost(method: AcquisitionMethod, def: SpeciesDef): number {
  if (method === "sanctuary_transfer") {
    return speciesRarity(def) === "legendary" ? 12 : speciesRarity(def) === "rare" ? 8 : 4;
  }
  if (method === "adopt" && speciesRarity(def) !== "common") return 2;
  return 0;
}

export function startingStatsForMethod(method: AcquisitionMethod): {
  health: number;
  hunger: number;
  welfare: number;
} {
  switch (method) {
    case "rescue_wild":
      return { health: 42, hunger: 55, welfare: 48 };
    case "deprecated_zoo":
      return { health: 72, hunger: 70, welfare: 52 };
    case "shelter":
      return { health: 78, hunger: 75, welfare: 58 };
    case "adopt":
      return { health: 88, hunger: 80, welfare: 62 };
    case "spotted":
      return { health: 92, hunger: 88, welfare: 72 };
    case "sanctuary_transfer":
      return { health: 85, hunger: 82, welfare: 65 };
    default:
      return { health: 95, hunger: 85, welfare: 70 };
  }
}

function flavorFor(method: AcquisitionMethod): string {
  switch (method) {
    case "rescue_wild":
      return pick(RESCUE_FLAVOR);
    case "spotted":
      return pick(SPOTTED_FLAVOR);
    case "deprecated_zoo":
      return pick(ZOO_FLAVOR);
    case "shelter":
      return pick(SHELTER_FLAVOR);
    case "adopt":
      return pick(ADOPT_FLAVOR);
    case "sanctuary_transfer":
      return pick(SANCTUARY_FLAVOR);
    default:
      return "Available for placement";
  }
}

let offerSeq = 0;
export function nextOfferId(): string {
  offerSeq += 1;
  return `offer-${offerSeq}`;
}

/** Reset offer id sequence in tests. */
export function resetOfferIdSeq(n = 0): void {
  offerSeq = n;
}

export function makeOffer(
  speciesId: string,
  method: AcquisitionMethod,
  day: number,
  opts?: {
    label?: string;
    expiresInDays?: number;
    rarityOverride?: AnimalRarity;
    id?: string;
  },
): AcquisitionOffer | null {
  const def = SPECIES_BY_ID[speciesId];
  if (!def) return null;
  const expiresInDays = opts?.expiresInDays ?? (method === "spotted" ? 3 : method === "rescue_wild" ? 4 : 7);
  const stats = startingStatsForMethod(method);
  return {
    id: opts?.id ?? nextOfferId(),
    speciesId,
    method,
    label: opts?.label ?? flavorFor(method),
    cashCost: offerCashCost(def, method),
    conservationCost: offerConservationCost(method, def),
    expiresDay: day + expiresInDays,
    createdDay: day,
    rarityOverride: opts?.rarityOverride,
    startingHealth: stats.health,
    startingHunger: stats.hunger,
    startingWelfare: stats.welfare,
  };
}

function speciesPool(filter: (d: SpeciesDef) => boolean): SpeciesDef[] {
  return SPECIES.filter(filter);
}

function randomSpecies(pool: SpeciesDef[]): string | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!.id;
}

/** Opening offers so new parks aren't buy-only. */
export function createStarterOffers(day: number): AcquisitionOffer[] {
  const common = speciesPool((d) => speciesRarity(d) === "common");
  const uncommon = speciesPool((d) => speciesRarity(d) === "uncommon");
  const out: AcquisitionOffer[] = [];
  const s1 = randomSpecies(common);
  const s2 = randomSpecies(uncommon.length ? uncommon : common);
  if (s1) out.push(makeOffer(s1, "shelter", day, { expiresInDays: 10 })!);
  if (s2) out.push(makeOffer(s2, "adopt", day, { expiresInDays: 8 })!);
  return out;
}

export function pruneExpiredOffers(offers: AcquisitionOffer[], day: number): AcquisitionOffer[] {
  return offers.filter((o) => o.expiresDay > day);
}

/** Roll new intakes at day boundary — keeps a lively acquisition board. */
export function rollDailyOffers(
  day: number,
  offers: AcquisitionOffer[],
  parkRating: number,
): AcquisitionOffer[] {
  let next = pruneExpiredOffers(offers, day);
  if (next.length >= MAX_ACTIVE_OFFERS) return next;

  const common = speciesPool((d) => speciesRarity(d) === "common");
  const mid = speciesPool((d) => ["common", "uncommon"].includes(speciesRarity(d)));
  const rarePool = speciesPool((d) => ["rare", "legendary"].includes(speciesRarity(d)));

  const push = (offer: AcquisitionOffer | null) => {
    if (!offer) return;
    if (next.some((o) => o.speciesId === offer.speciesId && o.method === offer.method)) return;
    next = [...next, offer];
  };

  // Shelter rotation — frequent, cheap.
  if (Math.random() < 0.72) {
    const id = randomSpecies(common);
    if (id) push(makeOffer(id, "shelter", day));
  }

  // Wild rescue — injured individuals.
  if (Math.random() < 0.38) {
    const id = randomSpecies(mid);
    if (id) push(makeOffer(id, "rescue_wild", day));
  }

  // Retired / closing zoo lots.
  if (Math.random() < 0.28) {
    const id = randomSpecies(mid);
    if (id) push(makeOffer(id, "deprecated_zoo", day, { expiresInDays: 5 }));
  }

  // Adoption / sanctuary — conservation-flavoured.
  if (Math.random() < 0.32) {
    const id = randomSpecies(mid);
    if (id) push(makeOffer(id, Math.random() < 0.55 ? "adopt" : "sanctuary_transfer", day));
  }

  // Spotted nearby — rarer, short window; better parks see more.
  const spotChance = 0.12 + parkRating * 0.04;
  if (Math.random() < spotChance && rarePool.length > 0) {
    const id = randomSpecies(rarePool);
    if (id) {
      const def = SPECIES_BY_ID[id]!;
      push(
        makeOffer(id, "spotted", day, {
          expiresInDays: 3,
          rarityOverride:
            speciesRarity(def) === "legendary" ? "legendary" : speciesRarity(def) === "rare" ? "rare" : "uncommon",
        }),
      );
    }
  }

  return next.slice(0, MAX_ACTIVE_OFFERS);
}

export function canAcquireSpecies(
  speciesId: string,
  habitat: Habitat,
  finances: Finances,
  cashCost: number,
  conservationCost = 0,
): boolean {
  const def = SPECIES_BY_ID[speciesId];
  if (!def) return false;
  if (finances.cash < cashCost) return false;
  if (finances.conservationPoints < conservationCost) return false;
  if (habitat.biome !== def.biome) return false;
  if (habitat.speciesId && habitat.speciesId !== def.id) return false;
  return true;
}

export function canAcquireOffer(
  offer: AcquisitionOffer,
  habitat: Habitat,
  finances: Finances,
): boolean {
  return canAcquireSpecies(
    offer.speciesId,
    habitat,
    finances,
    offer.cashCost,
    offer.conservationCost ?? 0,
  );
}
