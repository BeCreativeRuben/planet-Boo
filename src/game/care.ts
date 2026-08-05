/**
 * Wildhaven — animal care (feeding, healing, starvation, death).
 *
 * Pure helpers called from the store on the welfare interval and at day end.
 * Keepers restore hunger / hygiene; vets restore health; unpaid starvation
 * drains health until the animal dies. Old age also ends a life when age
 * reaches lifespan.
 */

import type { Animal, Building, Habitat, Staff } from "./types";
import { SPECIES_BY_ID } from "./species";

const clamp = (n: number, lo = 0, hi = 100): number =>
  Math.max(lo, Math.min(hi, n));

export type DeathCause = "starvation" | "old_age" | "illness";

export interface AnimalDeath {
  id: string;
  name: string;
  speciesId: string;
  cause: DeathCause;
  habitatId?: string;
}

export interface CareResult {
  animals: Record<string, Animal>;
  habitats: Record<string, Habitat>;
  staff: Record<string, Staff>;
  deaths: AnimalDeath[];
}

/** How many animals one keeper can feed per care pulse. */
const KEEPER_FEED_SLOTS = 4;
/** Hunger restored per fed animal on the welfare interval. */
const KEEPER_FEED_PULSE = 10;
/** Extra hunger restored per animal at day-end care. */
const KEEPER_FEED_DAY = 18;
/** Hygiene restored per habitat a keeper tends (pulse) — light tidy while feeding. */
const KEEPER_CLEAN_PULSE = 0.6;
/** Hygiene restored per habitat at day end (keeper incidental). */
const KEEPER_CLEAN_DAY = 2.5;
/** Hygiene restored per habitat a dedicated cleaner tends (pulse). */
const CLEANER_CLEAN_PULSE = 8;
/** Hygiene restored per habitat at day end (cleaner). */
const CLEANER_CLEAN_DAY = 18;
/** Habitats one cleaner can scrub per pulse. */
const CLEANER_SLOTS = 3;
/** Hygiene decay each day when uncleaned. */
const HYGIENE_DECAY_DAY = 4;

/** Animals one vet can treat per pulse. */
const VET_SLOTS = 3;
/** Health restored per treated animal (pulse). */
const VET_HEAL_PULSE = 8;
/** Health restored per treated animal (day). */
const VET_HEAL_DAY = 16;

/** Hunger below this starts health drain. */
const STARVE_THRESHOLD = 20;
/** Hunger at/below this is critical (faster drain + sickness). */
const STARVE_CRITICAL = 5;

function keeperHutBoost(habitat: Habitat, buildings: Record<string, Building>): number {
  const cx = (habitat.bounds.min.x + habitat.bounds.max.x) / 2;
  const cz = (habitat.bounds.min.z + habitat.bounds.max.z) / 2;
  for (const b of Object.values(buildings)) {
    if (b.defId !== "keeper-hut") continue;
    const dx = b.position.x - cx;
    const dz = b.position.z - cz;
    if (dx * dx + dz * dz <= 22 * 22) return 1.35;
  }
  return 1;
}

function vetClinicBoost(buildings: Record<string, Building>): number {
  for (const b of Object.values(buildings)) {
    if (b.defId === "vet-clinic") return 1.25;
  }
  return 1;
}

function listByRole(staff: Record<string, Staff>, role: Staff["role"]): Staff[] {
  return Object.values(staff).filter((m) => m.role === role && m.energy > 8);
}

/** Prefer hungriest animals that still live in a habitat. */
function hungriest(animals: Animal[], limit: number): Animal[] {
  return [...animals]
    .filter((a) => a.habitatId)
    .sort((a, b) => a.hunger - b.hunger)
    .slice(0, limit);
}

/** Prefer sickest / lowest-health animals. */
function neediestHealth(animals: Animal[], limit: number): Animal[] {
  return [...animals]
    .filter((a) => a.habitatId)
    .sort((a, b) => {
      const as = (a.sick ? -40 : 0) + a.health;
      const bs = (b.sick ? -40 : 0) + b.health;
      return as - bs;
    })
    .slice(0, limit);
}

function assignStaffTargets(
  staff: Record<string, Staff>,
  habitats: Record<string, Habitat>,
): Record<string, Staff> {
  const habitatIds = Object.values(habitats)
    .filter((h) => h.animalIds.length > 0)
    .map((h) => h.id);
  if (habitatIds.length === 0) {
    const cleared: Record<string, Staff> = {};
    for (const [id, m] of Object.entries(staff)) {
      cleared[id] = { ...m, assignments: [], targetId: undefined };
    }
    return cleared;
  }

  const next: Record<string, Staff> = { ...staff };
  let i = 0;
  for (const m of Object.values(staff)) {
    if (m.role !== "keeper" && m.role !== "vet" && m.role !== "cleaner") {
      next[m.id] = m;
      continue;
    }
    // Round-robin habitats so coverage spreads across the park.
    const primary = habitatIds[i % habitatIds.length]!;
    const secondary = habitatIds[(i + 1) % habitatIds.length]!;
    const assignments = primary === secondary ? [primary] : [primary, secondary];
    next[m.id] = { ...m, assignments, targetId: primary };
    i++;
  }
  return next;
}

function applyFeeding(
  animals: Record<string, Animal>,
  habitats: Record<string, Habitat>,
  staff: Record<string, Staff>,
  buildings: Record<string, Building>,
  feedAmount: number,
  cleanAmount: number,
): { animals: Record<string, Animal>; habitats: Record<string, Habitat>; staff: Record<string, Staff> } {
  const keepers = listByRole(staff, "keeper");
  if (keepers.length === 0) {
    return { animals, habitats, staff };
  }

  const nextAnimals: Record<string, Animal> = { ...animals };
  const nextHabitats: Record<string, Habitat> = { ...habitats };
  const nextStaff: Record<string, Staff> = { ...staff };
  const fed = new Set<string>();

  for (const keeper of keepers) {
    const pool = hungriest(
      Object.values(nextAnimals).filter((a) => !fed.has(a.id)),
      KEEPER_FEED_SLOTS,
    );
    let fedCount = 0;
    for (const a of pool) {
      const habitat = a.habitatId ? nextHabitats[a.habitatId] : undefined;
      if (!habitat) continue;
      const boost = keeperHutBoost(habitat, buildings);
      const hunger = clamp(a.hunger + feedAmount * boost);
      nextAnimals[a.id] = { ...a, hunger };
      fed.add(a.id);
      fedCount++;

      // Light clean when a keeper works this enclosure.
      const hygiene = clamp(habitat.hygiene + cleanAmount * 0.35 * boost);
      nextHabitats[habitat.id] = { ...habitat, hygiene };
    }
    const energy = clamp(keeper.energy - 2 - fedCount * 0.5, 0, 100);
    nextStaff[keeper.id] = { ...keeper, energy };
  }

  return { animals: nextAnimals, habitats: nextHabitats, staff: nextStaff };
}

function applyHealing(
  animals: Record<string, Animal>,
  staff: Record<string, Staff>,
  buildings: Record<string, Building>,
  healAmount: number,
): { animals: Record<string, Animal>; staff: Record<string, Staff> } {
  const vets = listByRole(staff, "vet");
  if (vets.length === 0) return { animals, staff };

  const boost = vetClinicBoost(buildings);
  const nextAnimals: Record<string, Animal> = { ...animals };
  const nextStaff: Record<string, Staff> = { ...staff };
  const treated = new Set<string>();

  for (const vet of vets) {
    const pool = neediestHealth(
      Object.values(nextAnimals).filter((a) => !treated.has(a.id) && (a.sick || a.health < 92)),
      VET_SLOTS,
    );
    let n = 0;
    for (const a of pool) {
      const health = clamp(a.health + healAmount * boost);
      nextAnimals[a.id] = {
        ...a,
        health,
        sick: health < 75 ? a.sick && health < 70 : false,
      };
      treated.add(a.id);
      n++;
    }
    nextStaff[vet.id] = { ...vet, energy: clamp(vet.energy - 3 - n, 0, 100) };
  }

  return { animals: nextAnimals, staff: nextStaff };
}

/** Prefer dirtiest habitats that still house animals. */
function dirtiestHabitats(habitats: Habitat[], limit: number): Habitat[] {
  return [...habitats]
    .filter((h) => h.animalIds.length > 0)
    .sort((a, b) => a.hygiene - b.hygiene)
    .slice(0, limit);
}

/**
 * Dedicated habitat cleaners restore hygiene on the messiest enclosures.
 * Keepers still contribute a light tidy while feeding.
 */
function applyHabitatCleaning(
  habitats: Record<string, Habitat>,
  staff: Record<string, Staff>,
  cleanAmount: number,
): { habitats: Record<string, Habitat>; staff: Record<string, Staff> } {
  const cleaners = listByRole(staff, "cleaner");
  if (cleaners.length === 0) return { habitats, staff };

  const nextHabitats: Record<string, Habitat> = { ...habitats };
  const nextStaff: Record<string, Staff> = { ...staff };
  const scrubbed = new Set<string>();

  for (const cleaner of cleaners) {
    const pool = dirtiestHabitats(
      Object.values(nextHabitats).filter((h) => !scrubbed.has(h.id)),
      CLEANER_SLOTS,
    );
    let n = 0;
    for (const h of pool) {
      const hygiene = clamp(h.hygiene + cleanAmount);
      nextHabitats[h.id] = { ...h, hygiene };
      scrubbed.add(h.id);
      n++;
    }
    nextStaff[cleaner.id] = {
      ...cleaner,
      energy: clamp(cleaner.energy - 2.5 - n * 0.8, 0, 100),
    };
  }

  return { habitats: nextHabitats, staff: nextStaff };
}

function applyStarvationEffects(
  animals: Record<string, Animal>,
  intensity: "pulse" | "day",
): Record<string, Animal> {
  const healthHit = intensity === "day" ? 8 : 2.5;
  const critHit = intensity === "day" ? 14 : 4;
  const next: Record<string, Animal> = {};

  for (const a of Object.values(animals)) {
    let health = a.health;
    let sick = a.sick;
    if (a.hunger <= STARVE_CRITICAL) {
      health = clamp(health - critHit);
      sick = true;
    } else if (a.hunger < STARVE_THRESHOLD) {
      const t = (STARVE_THRESHOLD - a.hunger) / STARVE_THRESHOLD;
      health = clamp(health - healthHit * (0.4 + t));
      if (a.hunger < 12) sick = true;
    } else if (!sick && health < 100) {
      // Mild natural recovery when well fed.
      health = clamp(health + (intensity === "day" ? 1.5 : 0.2));
    }
    next[a.id] = { ...a, health, sick };
  }
  return next;
}

function decayHygiene(
  habitats: Record<string, Habitat>,
  amount: number,
): Record<string, Habitat> {
  const next: Record<string, Habitat> = {};
  for (const [id, h] of Object.entries(habitats)) {
    next[id] = { ...h, hygiene: clamp(h.hygiene - amount) };
  }
  return next;
}

function recoverStaffEnergy(staff: Record<string, Staff>, amount: number): Record<string, Staff> {
  const next: Record<string, Staff> = {};
  for (const [id, m] of Object.entries(staff)) {
    next[id] = { ...m, energy: clamp(m.energy + amount) };
  }
  return next;
}

function collectDeaths(animals: Record<string, Animal>): AnimalDeath[] {
  const deaths: AnimalDeath[] = [];
  for (const a of Object.values(animals)) {
    if (a.health <= 0) {
      deaths.push({
        id: a.id,
        name: a.name,
        speciesId: a.speciesId,
        cause: a.hunger <= STARVE_THRESHOLD || a.sick ? "starvation" : "illness",
        habitatId: a.habitatId,
      });
    } else if (a.age >= a.lifespan) {
      deaths.push({
        id: a.id,
        name: a.name,
        speciesId: a.speciesId,
        cause: "old_age",
        habitatId: a.habitatId,
      });
    }
  }
  return deaths;
}

/** Remove dead animals from animal + habitat maps. */
export function purgeDeaths(
  animals: Record<string, Animal>,
  habitats: Record<string, Habitat>,
  deaths: AnimalDeath[],
): { animals: Record<string, Animal>; habitats: Record<string, Habitat> } {
  if (deaths.length === 0) return { animals, habitats };
  const dead = new Set(deaths.map((d) => d.id));
  const nextAnimals: Record<string, Animal> = {};
  for (const [id, a] of Object.entries(animals)) {
    if (!dead.has(id)) nextAnimals[id] = a;
  }
  const nextHabitats: Record<string, Habitat> = {};
  for (const [id, h] of Object.entries(habitats)) {
    const animalIds = h.animalIds.filter((aid) => !dead.has(aid));
    nextHabitats[id] = { ...h, animalIds };
  }
  return { animals: nextAnimals, habitats: nextHabitats };
}

export function deathMessage(d: AnimalDeath): { title: string; message: string } {
  const species = SPECIES_BY_ID[d.speciesId]?.name ?? "animal";
  if (d.cause === "old_age") {
    return {
      title: `${d.name} the ${species} has died of old age`,
      message: "A long life in the park — consider adopting a younger companion.",
    };
  }
  if (d.cause === "illness") {
    return {
      title: `${d.name} the ${species} has died of illness`,
      message: "Hire a veterinarian and keep animals well fed to prevent this.",
    };
  }
  return {
    title: `${d.name} the ${species} has starved`,
    message: "Hire zookeepers (and a nearby Keeper Hut) so animals get fed.",
  };
}

/**
 * Mid-day care pulse (runs with the welfare interval after hunger drain).
 * Keepers feed, vets heal, starvation bites, deaths are collected.
 * `careMult` > 1 speeds work during the night maintenance shift.
 */
export function applyCarePulse(
  animals: Record<string, Animal>,
  habitats: Record<string, Habitat>,
  staff: Record<string, Staff>,
  buildings: Record<string, Building>,
  careMult = 1,
): CareResult {
  let nextStaff = assignStaffTargets(staff, habitats);
  let fed = applyFeeding(
    animals,
    habitats,
    nextStaff,
    buildings,
    KEEPER_FEED_PULSE * careMult,
    KEEPER_CLEAN_PULSE * careMult,
  );
  let scrubbed = applyHabitatCleaning(fed.habitats, fed.staff, CLEANER_CLEAN_PULSE * careMult);
  let healed = applyHealing(fed.animals, scrubbed.staff, buildings, VET_HEAL_PULSE * careMult);
  const starved = applyStarvationEffects(healed.animals, "pulse");
  const deaths = collectDeaths(starved);
  const purged = purgeDeaths(starved, scrubbed.habitats, deaths);

  // Tiny energy recovery between pulses so staff don't permanently deplete.
  nextStaff = recoverStaffEnergy(healed.staff, 1.2 * Math.max(1, careMult * 0.85));

  return {
    animals: purged.animals,
    habitats: purged.habitats,
    staff: nextStaff,
    deaths,
  };
}

/**
 * End-of-day care: hygiene decay, stronger feed/heal, starvation, age deaths.
 * Caller should already have applied daily hunger drain + age increment.
 */
export function applyDailyCare(
  animals: Record<string, Animal>,
  habitats: Record<string, Habitat>,
  staff: Record<string, Staff>,
  buildings: Record<string, Building>,
): CareResult {
  let nextHabitats = decayHygiene(habitats, HYGIENE_DECAY_DAY);
  let nextStaff = assignStaffTargets(staff, nextHabitats);
  nextStaff = recoverStaffEnergy(nextStaff, 28);

  const fed = applyFeeding(
    animals,
    nextHabitats,
    nextStaff,
    buildings,
    KEEPER_FEED_DAY,
    KEEPER_CLEAN_DAY,
  );
  const scrubbed = applyHabitatCleaning(fed.habitats, fed.staff, CLEANER_CLEAN_DAY);
  const healed = applyHealing(fed.animals, scrubbed.staff, buildings, VET_HEAL_DAY);
  const starved = applyStarvationEffects(healed.animals, "day");
  const deaths = collectDeaths(starved);
  const purged = purgeDeaths(starved, scrubbed.habitats, deaths);

  return {
    animals: purged.animals,
    habitats: purged.habitats,
    staff: healed.staff,
    deaths,
  };
}

/** Suggested lifespan in park-days by size class (used at adoption). */
export function lifespanForSpecies(speciesId: string): number {
  const size = SPECIES_BY_ID[speciesId]?.size ?? "medium";
  switch (size) {
    case "small":
      return 420;
    case "medium":
      return 520;
    case "large":
      return 620;
    case "huge":
      return 720;
    default:
      return 520;
  }
}

/**
 * Adult spawn age that always leaves remaining lifespan.
 * Avoids animals dying of "old age" on the first care pulse.
 */
export function spawnAgeForLifespan(lifespan: number): number {
  const min = Math.max(20, Math.floor(lifespan * 0.12));
  const max = Math.max(min + 1, Math.floor(lifespan * 0.55));
  return min + Math.floor(Math.random() * (max - min));
}
