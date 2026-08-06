/**
 * Wildhaven — read selectors.
 *
 * Small, pure derivations over the game state, shared by the HUD and panels so
 * the same numbers appear everywhere. None of these mutate or subscribe; call
 * them with a slice of state (or let them read the store directly).
 */

import type { Animal, WelfareResult } from "../game/types";
import { SPECIES_BY_ID } from "../game/species";
import { METHOD_META } from "../game/acquisition";
import { computeWelfare, worstFactor } from "../game/welfare";
import { isBankrupt } from "../game/economy";
import type { GameNotification } from "./uiStore";
import { useGameStore } from "./gameStore";

/** Aggregate park appeal from animals (weighted by welfare) plus a baseline. */
export function parkAppeal(animals: Record<string, Animal>): number {
  let appeal = 8;
  for (const a of Object.values(animals)) {
    const def = SPECIES_BY_ID[a.speciesId];
    if (!def) continue;
    appeal += def.appeal * (0.4 + (a.welfare / 100) * 0.6) * 0.35;
  }
  return Math.round(appeal);
}

/** Full welfare breakdown for one animal, resolved against its live habitat. */
export function welfareForAnimal(id: string): WelfareResult | null {
  const s = useGameStore.getState();
  const animal = s.animals[id];
  if (!animal) return null;
  const habitat = animal.habitatId ? s.habitats[animal.habitatId] : undefined;
  let herd = 1;
  if (habitat) {
    herd = habitat.animalIds.filter((aid) => s.animals[aid]?.speciesId === animal.speciesId).length;
  }
  return computeWelfare(animal, habitat, Math.max(1, herd));
}

/**
 * Derive the current set of player-facing notifications from game state:
 * critical-welfare animals, deaths, bankruptcy warnings and milestones. Ids are
 * stable so the UI can remember which ones the player dismissed.
 */
export function deriveNotifications(): GameNotification[] {
  const s = useGameStore.getState();
  const out: GameNotification[] = [];

  if (isBankrupt(s.finances)) {
    out.push({
      id: "bankrupt",
      kind: "critical",
      title: "The park is running out of money",
      message: "Raise ticket prices or trim costs before the bank steps in.",
      sticky: true,
    });
  }

  for (const notice of s.deathNotices) {
    out.push({
      id: notice.id,
      kind: "critical",
      title: notice.title,
      message: notice.message,
      sticky: true,
    });
  }

  const keeperCount = Object.values(s.staff).filter((m) => m.role === "keeper").length;
  if (Object.keys(s.animals).length > 0 && keeperCount === 0) {
    out.push({
      id: "no-keepers",
      kind: "warning",
      title: "No zookeepers on payroll",
      message: "Animals will starve without keepers. Hire one from the Staff tab.",
    });
  }

  for (const offer of s.animalOffers) {
    if (offer.createdDay !== s.day) continue;
    const def = SPECIES_BY_ID[offer.speciesId];
    const meta = METHOD_META[offer.method];
    const urgent = offer.method === "spotted" || offer.method === "rescue_wild";
    out.push({
      id: `offer-${offer.id}`,
      kind: urgent ? "warning" : "info",
      title: `${meta.icon} ${meta.label}: ${def?.name ?? "animal"}`,
      message: `${offer.label} — open Animals tab before it expires.`,
    });
  }

  for (const a of Object.values(s.animals)) {
    if (a.hunger <= 15 || a.health <= 25) {
      const def = SPECIES_BY_ID[a.speciesId];
      out.push({
        id: `starve-${a.id}`,
        kind: a.health <= 15 || a.hunger <= 5 ? "critical" : "warning",
        title:
          a.health <= 15
            ? `${a.name} the ${def?.name ?? "animal"} is dying`
            : `${a.name} the ${def?.name ?? "animal"} is starving`,
        message:
          a.hunger <= 15
            ? "Hunger is critical — hire keepers or they will not last."
            : "Health is failing — call a vet and keep them fed.",
      });
    } else if (a.welfare < 45) {
      const def = SPECIES_BY_ID[a.speciesId];
      const w = welfareForAnimal(a.id);
      const worst = w ? worstFactor(w) : undefined;
      out.push({
        id: `welfare-${a.id}`,
        kind: a.welfare < 30 ? "critical" : "warning",
        title: `${a.name} the ${def?.name ?? "animal"} is unhappy`,
        message: worst ? `Lowest factor: ${worst.label} (${worst.value}%).` : undefined,
      });
    }
  }

  if (s.stats.rating >= 4 && Object.keys(s.animals).length >= 4) {
    out.push({
      id: "milestone-4star",
      kind: "success",
      title: "Wildhaven just hit a 4-star rating!",
      message: "Word is spreading — expect bigger crowds.",
    });
  }

  return out;
}
