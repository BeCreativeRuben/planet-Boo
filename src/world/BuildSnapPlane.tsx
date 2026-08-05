/**
 * Wildhaven — build snap plane.
 *
 * Flat invisible ground used for all placement raycasts. Guarantees fences,
 * gates and other buildables snap to the integer grid even when the pointer is
 * over bumpy terrain, existing fences, animals or guests.
 *
 * Fence / gate tools support click-drag painting: every newly entered cell
 * along the stroke gets a segment, auto-rotated to match that step's direction.
 */

import { useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import {
  worldToCell,
  inPlot,
  cellCenter,
  collectFenceCells,
  fenceRotationFromNeighbors,
  fenceRotationForStroke,
  footprintCells,
  footprintCenter,
} from "../game/simulation";
import { getBuilding } from "../game/buildings";
import type { Vec2 } from "../game/types";

function cellFromPoint(point: THREE.Vector3, plotSize: number): Vec2 | null {
  const cx = worldToCell(point.x);
  const cz = worldToCell(point.z);
  if (!inPlot(cx, plotSize) || !inPlot(cz, plotSize)) return null;
  return { x: cx, z: cz };
}

/** Bresenham line across grid cells (inclusive). */
function lineCells(a: Vec2, b: Vec2): Vec2[] {
  const cells: Vec2[] = [];
  let x0 = a.x;
  let z0 = a.z;
  const x1 = b.x;
  const z1 = b.z;
  const dx = Math.abs(x1 - x0);
  const dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  for (;;) {
    cells.push({ x: x0, z: z0 });
    if (x0 === x1 && z0 === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) {
      err -= dz;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      z0 += sz;
    }
  }
  return cells;
}

function resolvePlaceId(): string | undefined {
  const { build } = useGameStore.getState();
  if (build.tool === "fence") return build.selectedDefId ?? "fence-segment";
  if (build.tool === "gate") return build.selectedDefId ?? "habitat-gate";
  if (build.tool === "place") return build.selectedDefId;
  return undefined;
}

function isFenceLike(defId: string | undefined): boolean {
  return defId === "fence-segment" || defId === "habitat-gate";
}

function neighborFenceRotation(cell: Vec2, fallback: number): number {
  const fences = collectFenceCells(useGameStore.getState().buildings);
  return fenceRotationFromNeighbors(cell, fences, fallback);
}

/** Update yaw on an already-placed fence/gate occupying `cell`. */
function reorientFenceAt(cell: Vec2, rotation: number) {
  const store = useGameStore.getState();
  for (const b of Object.values(store.buildings)) {
    if (b.defId !== "fence-segment" && b.defId !== "habitat-gate") continue;
    if (!footprintCells(b).some((c) => c.x === cell.x && c.z === cell.z)) continue;
    if (b.rotation === rotation) return;
    const def = getBuilding(b.defId);
    useGameStore.setState((s) => ({
      buildings: {
        ...s.buildings,
        [b.instanceId]: {
          ...b,
          rotation,
          position: footprintCenter(cell, def, rotation),
        },
      },
    }));
    return;
  }
}

export function BuildSnapPlane() {
  const active = useGameStore((s) => s.build.active);
  const tool = useGameStore((s) => s.build.tool);
  const plotSize = useGameStore((s) => s.plotSize);
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null;

  const painting = useRef(false);
  const lastCell = useRef<Vec2 | null>(null);
  const strokeRot = useRef(0);
  const painted = useRef<Set<string>>(new Set());
  const startCell = useRef<Vec2 | null>(null);
  const reorientedStart = useRef(false);

  if (!active || tool === "none" || tool === "delete" || tool === "animal") {
    return null;
  }

  // Claim tool: click inside a closed fence to register a habitat.
  if (tool === "claim") {
    return <ClaimSnapPlane plotSize={plotSize} />;
  }

  const setControlsEnabled = (on: boolean) => {
    if (controls && "enabled" in controls) controls.enabled = on;
  };

  const placeAt = (cell: Vec2, rotation: number) => {
    const defId = resolvePlaceId();
    if (!defId) return;
    const key = `${cell.x},${cell.z}`;
    if (painted.current.has(key)) return;
    useGameStore.getState().placeBuilding(defId, cell, rotation);
    painted.current.add(key);
  };

  const updateHover = (cell: Vec2 | null, rotation?: number) => {
    const store = useGameStore.getState();
    if (rotation !== undefined && rotation !== store.build.rotation) {
      store.setBuildMode({ rotation });
    }
    store.setHoverCell(cell);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const cell = cellFromPoint(e.point, plotSize);
    if (!cell) {
      updateHover(null);
      return;
    }

    const defId = resolvePlaceId();
    const fence = isFenceLike(defId);

    if (painting.current && lastCell.current) {
      const path = lineCells(lastCell.current, cell);
      let prev = lastCell.current;
      for (const c of path) {
        if (c.x === prev.x && c.z === prev.z) continue;
        const rot = fence
          ? fenceRotationForStroke(prev, c, strokeRot.current)
          : useGameStore.getState().build.rotation;
        if (fence) {
          strokeRot.current = rot;
          // Once the stroke has a direction, twist the first cell to match.
          if (!reorientedStart.current && startCell.current) {
            reorientFenceAt(startCell.current, rot);
            reorientedStart.current = true;
          }
        }
        placeAt(c, rot);
        prev = c;
      }
      lastCell.current = cell;
      updateHover(cell, fence ? strokeRot.current : undefined);
      return;
    }

    if (fence) {
      updateHover(cell, neighborFenceRotation(cell, useGameStore.getState().build.rotation));
    } else {
      updateHover(cell);
    }
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const cell = cellFromPoint(e.point, plotSize);
    if (!cell) return;
    const defId = resolvePlaceId();
    if (!defId) return;

    painting.current = true;
    painted.current = new Set();
    lastCell.current = cell;
    startCell.current = cell;
    reorientedStart.current = false;

    const fence = isFenceLike(defId);
    strokeRot.current = fence
      ? neighborFenceRotation(cell, useGameStore.getState().build.rotation)
      : useGameStore.getState().build.rotation;

    setControlsEnabled(false);
    (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      e.pointerId,
    );

    placeAt(cell, strokeRot.current);
    updateHover(cell, strokeRot.current);
  };

  const endPaint = (e: ThreeEvent<PointerEvent>) => {
    if (!painting.current) return;
    e.stopPropagation();
    painting.current = false;
    lastCell.current = null;
    startCell.current = null;
    reorientedStart.current = false;
    painted.current = new Set();
    setControlsEnabled(true);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
  };

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={endPaint}
        onPointerCancel={endPaint}
        onPointerOut={() => {
          if (!painting.current) useGameStore.getState().setHoverCell(null);
        }}
        onClick={onClick}
      >
        <planeGeometry args={[plotSize, plotSize]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <SnapCellHighlight />
    </group>
  );
}

/** Bright cell under the cursor so snap is obvious. */
function SnapCellHighlight() {
  const hoverCell = useGameStore((s) => s.hoverCell);
  const valid = useGameStore((s) => s.build.valid);
  if (!hoverCell) return null;
  const c = cellCenter(hoverCell);
  const color = valid ? "#c9e8a0" : "#e0655a";
  return (
    <mesh position={[c.x, 0.06, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.96, 0.96]} />
      <meshBasicMaterial color={color} transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}

/** Click-to-claim plane for registering a fenced enclosure as a habitat. */
function ClaimSnapPlane({ plotSize }: { plotSize: number }) {
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null;

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const cell = cellFromPoint(e.point, plotSize);
    useGameStore.getState().setHoverCell(cell);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const cell = cellFromPoint(e.point, plotSize);
    if (!cell) return;
    if (controls && "enabled" in controls) controls.enabled = false;
    useGameStore.getState().createHabitat(cell);
  };

  const onPointerUp = () => {
    if (controls && "enabled" in controls) controls.enabled = true;
  };

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={() => useGameStore.getState().setHoverCell(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <planeGeometry args={[plotSize, plotSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <SnapCellHighlight />
    </group>
  );
}

export default BuildSnapPlane;
