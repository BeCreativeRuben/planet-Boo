/**
 * Wildhaven — economy.
 *
 * Pure money maths: how many guests a park attracts, what they spend, what the
 * animals, staff and buildings cost to run, and how a day is settled into the
 * ledger. The store owns the numbers; these functions never mutate state.
 *
 * Cash model
 * ----------
 * Operating income (tickets, shops, donations) and operating costs (food,
 * wages, upkeep) accrue into both the ledger *and* cash throughout the day.
 * Capital purchases hit cash + capitalSpend immediately. At day end, running
 * costs are snapped to exact daily totals and the ledger is archived.
 */

import type {
  Animal,
  Building,
  BuildingDef,
  Finances,
  LedgerDay,
  Staff,
} from "./types";
import { SPECIES_BY_ID } from "./species";
import { getBuilding } from "./buildings";
import { getStaffRole } from "./staffTypes";

/** Default ticket price when a new park is founded. */
export const DEFAULT_TICKET_PRICE = 18;

/** Sensible ticket price bounds for the finance slider. */
export const TICKET_PRICE_RANGE: [number, number] = [0, 60];

/* -------------------------------------------------------------------------- */
/*  Ledger                                                                    */
/* -------------------------------------------------------------------------- */

/** A fresh, zeroed ledger for the given day. */
export function newLedgerDay(day: number): LedgerDay {
  return {
    day,
    ticketIncome: 0,
    shopIncome: 0,
    donationIncome: 0,
    animalCosts: 0,
    staffWages: 0,
    upkeep: 0,
    capitalSpend: 0,
  };
}

/** Net profit / loss recorded on a ledger day. */
export function ledgerNet(l: LedgerDay): number {
  return (
    l.ticketIncome +
    l.shopIncome +
    l.donationIncome -
    l.animalCosts -
    l.staffWages -
    l.upkeep -
    l.capitalSpend
  );
}

/** Total income (before costs) on a ledger day. */
export function ledgerIncome(l: LedgerDay): number {
  return l.ticketIncome + l.shopIncome + l.donationIncome;
}

/** Total running + capital costs on a ledger day. */
export function ledgerExpense(l: LedgerDay): number {
  return l.animalCosts + l.staffWages + l.upkeep + l.capitalSpend;
}

/* -------------------------------------------------------------------------- */
/*  Setup                                                                     */
/* -------------------------------------------------------------------------- */

/** Create a finances object for a new park with the given starting cash. */
export function createFinances(cash: number): Finances {
  return {
    cash,
    conservationPoints: 0,
    ticketPrice: DEFAULT_TICKET_PRICE,
    today: newLedgerDay(1),
    history: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Spending                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Apply a one-off purchase: deduct cash and record it as capital spend on the
 * current ledger day. Returns a new finances object (never mutates).
 */
export function applyPurchase(finances: Finances, cost: number): Finances {
  if (cost <= 0) return finances;
  return {
    ...finances,
    cash: finances.cash - cost,
    today: { ...finances.today, capitalSpend: finances.today.capitalSpend + cost },
  };
}

/** Can the park afford a purchase of `cost`? */
export function canAfford(finances: Finances, cost: number): boolean {
  return finances.cash >= cost;
}

/* -------------------------------------------------------------------------- */
/*  Daily running costs                                                       */
/* -------------------------------------------------------------------------- */

/** Total food cost per day across every animal in the park. */
export function dailyAnimalCosts(animals: Record<string, Animal>): number {
  let total = 0;
  for (const a of Object.values(animals)) {
    const def = SPECIES_BY_ID[a.speciesId];
    if (def) total += def.foodCostPerDay;
  }
  return Math.round(total);
}

/** Total wages per day across all hired staff. */
export function dailyStaffWages(staff: Record<string, Staff>): number {
  let total = 0;
  for (const s of Object.values(staff)) {
    total += getStaffRole(s.role)?.wage ?? 0;
  }
  return Math.round(total);
}

/** Total facility upkeep per day across all placed buildings. */
export function dailyUpkeep(buildings: Record<string, Building>): number {
  let total = 0;
  for (const b of Object.values(buildings)) {
    total += getBuilding(b.defId)?.upkeep ?? 0;
  }
  // Keep cents so a fence-heavy park still shows a non-zero burn.
  return Math.round(total * 100) / 100;
}

/**
 * Voluntary guest donations, driven by how many educated, happy guests the park
 * has and its conservation standing.
 */
export function dailyDonations(
  guestCount: number,
  averageHappiness: number,
  infoBoards: number,
): number {
  const educated = 1 + Math.min(1.5, infoBoards * 0.15);
  const generosity = (averageHappiness / 100) * 0.4;
  return Math.round(guestCount * generosity * educated);
}

/* -------------------------------------------------------------------------- */
/*  Guests & revenue                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Expected number of guests the park draws in a day, from its appeal and how
 * aggressively it prices tickets. A gentle price sensitivity keeps things fair.
 */
export function expectedDailyGuests(appeal: number, ticketPrice: number): number {
  const priceFactor = Math.max(0.1, 1 - (ticketPrice - DEFAULT_TICKET_PRICE) / 90);
  return Math.max(0, Math.round(appeal * 6 * priceFactor));
}

/** Revenue from a single guest transaction at a revenue building. */
export function transactionRevenue(def: BuildingDef, guestHappiness: number): number {
  const base = def.revenuePerUse ?? 0;
  // Happier guests are looser with their wallets.
  return base * (0.7 + (guestHappiness / 100) * 0.6);
}

/**
 * How open a shop is right now (0 = closed, 1 = fully open).
 * Closed at night and when the building is falling apart.
 */
export function shopOpenFactor(timeOfDay: number, condition: number): number {
  if (condition < 15) return 0;
  // Night: closed.
  if (timeOfDay < 0.28 || timeOfDay >= 0.82) return 0;
  // Dawn / dusk: half staffed.
  if (timeOfDay < 0.34 || timeOfDay >= 0.75) return 0.55;
  return 1;
}

export function shopOpenLabel(factor: number, condition: number): string {
  if (condition < 15) return "Closed — needs repair";
  if (factor <= 0) return "Closed for the night";
  if (factor < 0.8) return "Open (quiet hours)";
  return "Open";
}

/** Vendor staffing boosts shop throughput (diminishing after a few vendors). */
export function vendorBoost(vendorCount: number): number {
  return 1 + Math.min(1.25, vendorCount * 0.22);
}

/* -------------------------------------------------------------------------- */
/*  In-day accrual                                                            */
/* -------------------------------------------------------------------------- */

export interface OperatingDelta {
  ticketIncome: number;
  shopIncome: number;
  donationIncome: number;
  animalCosts: number;
  staffWages: number;
  upkeep: number;
}

/** Apply an operating delta to both the ledger and cash. */
export function applyOperatingDelta(finances: Finances, delta: OperatingDelta): Finances {
  const net =
    delta.ticketIncome +
    delta.shopIncome +
    delta.donationIncome -
    delta.animalCosts -
    delta.staffWages -
    delta.upkeep;
  return {
    ...finances,
    cash: finances.cash + net,
    today: {
      ...finances.today,
      ticketIncome: finances.today.ticketIncome + delta.ticketIncome,
      shopIncome: finances.today.shopIncome + delta.shopIncome,
      donationIncome: finances.today.donationIncome + delta.donationIncome,
      animalCosts: finances.today.animalCosts + delta.animalCosts,
      staffWages: finances.today.staffWages + delta.staffWages,
      upkeep: finances.today.upkeep + delta.upkeep,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Day settlement                                                            */
/* -------------------------------------------------------------------------- */

export interface DayTotals {
  animalCosts: number;
  staffWages: number;
  upkeep: number;
  /** Conservation points earned this day. */
  conservationEarned?: number;
}

/**
 * Archive today's ledger (snapping running costs to exact daily totals) and
 * open a fresh ledger for the next day. Income/costs were already folded into
 * cash during the day; only the snap difference is applied here.
 */
export function settleDay(finances: Finances, totals: DayTotals): Finances {
  const today = finances.today;
  const foodAdj = totals.animalCosts - today.animalCosts;
  const wageAdj = totals.staffWages - today.staffWages;
  const upkeepAdj = totals.upkeep - today.upkeep;

  const settled: LedgerDay = {
    ...today,
    animalCosts: totals.animalCosts,
    staffWages: totals.staffWages,
    upkeep: totals.upkeep,
  };

  const nextDay = settled.day + 1;
  const history = [...finances.history, settled].slice(-30);

  return {
    ...finances,
    cash: finances.cash - foodAdj - wageAdj - upkeepAdj,
    conservationPoints:
      finances.conservationPoints + (totals.conservationEarned ?? 0),
    today: newLedgerDay(nextDay),
    history,
  };
}

/** Is the park insolvent (deep enough in the red to warn the player)? */
export function isBankrupt(finances: Finances): boolean {
  return finances.cash < -5000;
}
