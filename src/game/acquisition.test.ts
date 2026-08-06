import { describe, expect, it, beforeEach } from "vitest";

import {
  canAcquireSpecies,
  createStarterOffers,
  makeOffer,
  offerCashCost,
  resetOfferIdSeq,
  rollDailyOffers,
  speciesRarity,
} from "./acquisition";
import { SPECIES_BY_ID } from "./species";
import type { Finances, Habitat } from "./types";

const habitat: Habitat = {
  id: "h1",
  name: "Test",
  biome: "savanna",
  bounds: { min: { x: -10, z: -10 }, max: { x: 10, z: 10 } },
  area: 400,
  fenced: true,
  temperature: 24,
  humidity: 40,
  hygiene: 80,
  animalIds: [],
  buildingIds: [],
  enrichmentProvided: [],
};

const finances: Finances = {
  cash: 50_000,
  conservationPoints: 20,
  ticketPrice: 18,
  today: {
    day: 1,
    ticketIncome: 0,
    shopIncome: 0,
    donationIncome: 0,
    animalCosts: 0,
    staffWages: 0,
    upkeep: 0,
    capitalSpend: 0,
  },
  history: [],
};

beforeEach(() => resetOfferIdSeq(0));

describe("speciesRarity", () => {
  it("tiers flagship species higher", () => {
    expect(speciesRarity(SPECIES_BY_ID.elephant!)).toBe("legendary");
    expect(speciesRarity(SPECIES_BY_ID.meerkat!)).toBe("common");
  });
});

describe("makeOffer", () => {
  it("discounts retired zoo stock", () => {
    const def = SPECIES_BY_ID.lion!;
    const offer = makeOffer("lion", "deprecated_zoo", 3)!;
    expect(offer.cashCost).toBeLessThan(offerCashCost(def, "buy"));
  });

  it("sets weaker stats for wild rescues", () => {
    const offer = makeOffer("lion", "rescue_wild", 1)!;
    expect(offer.startingHealth).toBe(42);
    expect(offer.startingHunger).toBe(55);
  });
});

describe("rollDailyOffers", () => {
  it("adds shelter intakes over time", () => {
    const day1 = rollDailyOffers(2, createStarterOffers(1), 2);
    expect(day1.length).toBeGreaterThan(0);
    const day2 = rollDailyOffers(3, day1, 2);
    expect(day2.length).toBeGreaterThanOrEqual(day1.length - 1);
  });
});

describe("canAcquireSpecies", () => {
  it("blocks wrong biome", () => {
    expect(canAcquireSpecies("penguin", habitat, finances, 1000)).toBe(false);
  });

  it("allows matching biome with funds", () => {
    expect(canAcquireSpecies("lion", habitat, finances, 12_000)).toBe(true);
  });
});
