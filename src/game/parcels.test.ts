import { describe, expect, it } from "vitest";

import {
  createStarterParcels,
  listBuyableParcels,
  parcelKey,
  parcelPurchaseCost,
} from "./parcels";

describe("listBuyableParcels", () => {
  it("only offers edge-adjacent unowned parcels", () => {
    const owned = createStarterParcels();
    const buyable = listBuyableParcels(owned);
    const keys = new Set(buyable.map((b) => b.key));
    expect(keys.has(parcelKey(2, 1))).toBe(true);
    expect(keys.has(parcelKey(6, 3))).toBe(true);
    expect(keys.has(parcelKey(0, 0))).toBe(false);
    expect(keys.has(parcelKey(3, 3))).toBe(false);
  });

  it("labels south parcels toward the entrance", () => {
    const owned = createStarterParcels();
    const south = listBuyableParcels(owned).find((b) => b.pz === 6);
    expect(south?.direction).toMatch(/S/);
  });

  it("sorts by cost ascending", () => {
    const owned = createStarterParcels();
    const buyable = listBuyableParcels(owned);
    for (let i = 1; i < buyable.length; i++) {
      expect(buyable[i]!.cost).toBeGreaterThanOrEqual(buyable[i - 1]!.cost);
    }
  });
});

describe("parcelPurchaseCost", () => {
  it("charges a premium for south access land", () => {
    const ownedCount = createStarterParcels().length;
    const north = parcelPurchaseCost(ownedCount, 3, 1);
    const south = parcelPurchaseCost(ownedCount, 3, 6);
    expect(south).toBeGreaterThan(north);
  });
});
