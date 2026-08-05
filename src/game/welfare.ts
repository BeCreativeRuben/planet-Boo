/**
 * Wildhaven — animal welfare model.
 *
 * Given an animal, the habitat it lives in and its herd size, computes a 0..100
 * welfare score broken down into the factors a player can act on: biome match,
 * climate, space, social grouping, enrichment, hunger and health. Pure and
 * side-effect free so both the store and the HUD can call it freely.
 */

import type { Animal, Habitat, WelfareFactor, WelfareResult } from "./types";
import { SPECIES_BY_ID } from "./species";

const clamp = (n: number, lo = 0, hi = 100): number =>
  Math.max(lo, Math.min(hi, n));

/** Score how well a value sits inside a preferred [min, max] band (0..100). */
function bandScore(value: number, [min, max]: [number, number]): number {
  if (value >= min && value <= max) return 100;
  const span = Math.max(1, max - min);
  const distance = value < min ? min - value : value - max;
  // Falls off to 0 once roughly a full band-width outside the comfort zone.
  return clamp(100 - (distance / span) * 100);
}

/** Relative importance of each factor in the overall score. */
const WEIGHTS: Record<string, number> = {
  biome: 1.1,
  climate: 1.0,
  space: 1.2,
  social: 1.1,
  enrichment: 1.0,
  hunger: 1.3,
  health: 1.3,
};

/**
 * Compute an animal's welfare within its habitat.
 *
 * @param animal    The animal to evaluate.
 * @param habitat   The enclosure it lives in.
 * @param herdSize  Number of same-species animals sharing the habitat (>= 1).
 */
export function computeWelfare(
  animal: Animal,
  habitat: Habitat | undefined,
  herdSize: number,
): WelfareResult {
  const species = SPECIES_BY_ID[animal.speciesId];

  // An unplaced animal, or one with no species data, sits at a neutral baseline.
  if (!species || !habitat) {
    const factors: WelfareFactor[] = [
      { key: "hunger", label: "Hunger", value: clamp(animal.hunger) },
      { key: "health", label: "Health", value: clamp(animal.health) },
    ];
    return { score: Math.round((animal.hunger + animal.health) / 2), factors };
  }

  const biome = habitat.biome === species.biome ? 100 : 35;

  const tempScore = bandScore(habitat.temperature, species.preferredTemp);
  const humidityScore = bandScore(habitat.humidity, species.preferredHumidity);
  const climate = Math.round((tempScore + humidityScore) / 2);

  const needed = Math.max(1, species.spaceNeeded * herdSize);
  const space = clamp((habitat.area / needed) * 100);

  let social: number;
  if (herdSize < species.socialMin) {
    const deficit = (species.socialMin - herdSize) / species.socialMin;
    social = clamp(100 - deficit * 80);
  } else if (herdSize > species.socialMax) {
    const excess = (herdSize - species.socialMax) / species.socialMax;
    social = clamp(100 - excess * 60);
  } else {
    social = 100;
  }

  const needs = species.enrichmentNeeds;
  const met = needs.filter((n) => habitat.enrichmentProvided.includes(n)).length;
  const enrichment = needs.length ? clamp((met / needs.length) * 100) : 100;

  const hunger = clamp(animal.hunger);
  const health = clamp(animal.health);

  // Poor hygiene drags the whole enclosure down a little.
  const hygienePenalty = habitat.hygiene < 60 ? (60 - habitat.hygiene) * 0.3 : 0;

  const factors: WelfareFactor[] = [
    { key: "biome", label: "Biome", value: biome },
    { key: "climate", label: "Climate", value: climate },
    { key: "space", label: "Space", value: Math.round(space) },
    { key: "social", label: "Social", value: Math.round(social) },
    { key: "enrichment", label: "Enrichment", value: Math.round(enrichment) },
    { key: "hunger", label: "Fed", value: Math.round(hunger) },
    { key: "health", label: "Health", value: Math.round(health) },
  ];

  let weightedSum = 0;
  let weightTotal = 0;
  for (const f of factors) {
    const w = WEIGHTS[f.key] ?? 1;
    weightedSum += f.value * w;
    weightTotal += w;
  }
  const score = clamp(Math.round(weightedSum / weightTotal - hygienePenalty));

  return { score, factors };
}

/** A short, human-readable verdict for a welfare score. */
export function welfareLabel(score: number): string {
  if (score >= 85) return "Thriving";
  if (score >= 70) return "Content";
  if (score >= 50) return "Unsettled";
  if (score >= 30) return "Distressed";
  return "Critical";
}

/** The single worst factor, useful for surfacing an actionable warning. */
export function worstFactor(result: WelfareResult): WelfareFactor | undefined {
  return [...result.factors].sort((a, b) => a.value - b.value)[0];
}
