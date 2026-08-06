import { describe, expect, it } from "vitest";

import type { Building } from "./types";
import {
  GUESTS_PER_CAR,
  PARKING_STALLS_PER_LOT,
  lotStallCapacity,
  parkingGuestCapacity,
  parkingLotCarCounts,
} from "./parking";

function lot(id: string, z: number, condition = 100): Building {
  return {
    instanceId: id,
    defId: "parking-lot",
    category: "guest",
    position: { x: 0, z },
    rotation: 0,
    condition,
  };
}

function entrance(): Building {
  return {
    instanceId: "e1",
    defId: "entrance-arch",
    category: "guest",
    position: { x: 0, z: 0 },
    rotation: 0,
    condition: 100,
  };
}

describe("parkingGuestCapacity", () => {
  it("scales with stall count across lots", () => {
    const buildings = {
      e1: entrance(),
      p1: lot("p1", 10),
      p2: lot("p2", 40),
    };
    expect(parkingGuestCapacity({ e1: entrance(), p1: lot("p1", 10) })).toBe(
      Math.round(PARKING_STALLS_PER_LOT * GUESTS_PER_CAR),
    );
    expect(parkingGuestCapacity(buildings)).toBe(
      Math.round(PARKING_STALLS_PER_LOT * 2 * GUESTS_PER_CAR),
    );
  });
});

describe("parkingLotCarCounts", () => {
  it("fills nearer lots before farther ones", () => {
    const buildings = {
      e1: entrance(),
      near: lot("near", 10),
      far: lot("far", 40),
    };
    expect(parkingLotCarCounts(buildings, 10)).toEqual({ near: 4, far: 0 });
    expect(parkingLotCarCounts(buildings, 33)).toEqual({
      near: PARKING_STALLS_PER_LOT,
      far: 0,
    });
    const at50 = parkingLotCarCounts(buildings, 50);
    expect(at50.near).toBe(PARKING_STALLS_PER_LOT);
    expect(at50.far).toBeGreaterThan(0);
  });

  it("drops capacity when a lot is ruined", () => {
    const buildings = { e1: entrance(), p1: lot("p1", 10, 10) };
    expect(lotStallCapacity(buildings.p1)).toBe(0);
    expect(parkingLotCarCounts(buildings, 20)).toEqual({ p1: 0 });
  });
});
