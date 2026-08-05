/**
 * Wildhaven — build snap plane.
 *
 * Flat invisible ground used for all placement raycasts. Guarantees fences,
 * gates and other buildables snap to the integer grid even when the pointer is
 * over bumpy terrain, existing fences, animals or guests.
 *
 * Fence / gate tools support click-drag painting: every newly entered cell
 * along the stroke gets a segment, auto-rotated to match the stroke direction.
 */

import { useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import { MAP_SIZE, worldToCell, inBounds, cellCenter } from "../game/simulation";
import type { Vec2 } from "../game/types";

function cellFromPoint(point: THREE.Vector3): Vec2 | null {
  const cx = worldToCell(point.x);
  const cz = worldToCell(point.z);
  if (!inBounds(cx) || !inBounds(cz)) return null;
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

/** Fence mesh is thin on local Z — rotation 0 runs east–west, 1 north–south. */
function rotationForStroke(from: Vec2, to: Vec2, fallback: number): number {
  const dx = Math.abs(to.x - from.x);
  const dz = Math.abs(to.z - from.z);
  if (dx === 0 && dz === 0) return fallback;
  return dx >= dz ? 0 : 1;
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

export function BuildSnapPlane() {
  const active = useGameStore((s) => s.build.active);
  const tool = useGameStore((s) => s.build.tool);
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null;

  const painting = useRef(false);
  const lastCell = useRef<Vec2 | null>(null);
  const strokeRot = useRef(0);
  const painted = useRef<Set<string>>(new Set());

  if (!active || tool === "none" || tool === "delete" || tool === "animal") {
    return null;
  }

  const setControlsEnabled = (on: boolean) => {
    if (controls && "enabled" in controls) controls.enabled = on;
  };

  const placeAt = (cell: Vec2, rotation: number) => {
    const defId = resolvePlaceId();
    if (!defId) return;
    const key = `${cell.x},${cell.z}`;
    if (painted.current.has(key)) return;
    const store = useGameStore.getState();
    if (!store.build.valid && store.build.selectedDefId) {
      // validity is refreshed below; still try placeBuilding which re-checks
    }
    store.placeBuilding(defId, cell, rotation);
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
    const cell = cellFromPoint(e.point);
    if (!cell) {
      updateHover(null);
      return;
    }

    if (painting.current && lastCell.current) {
      const defId = resolvePlaceId();
      const fence = isFenceLike(defId);
      const rot = fence
        ? rotationForStroke(lastCell.current, cell, strokeRot.current)
        : useGameStore.getState().build.rotation;
      if (fence) strokeRot.current = rot;

      const path = lineCells(lastCell.current, cell);
      for (const c of path) {
        placeAt(c, rot);
      }
      lastCell.current = cell;
      updateHover(cell, rot);
      return;
    }

    updateHover(cell);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Left button only — let middle/right keep orbit/pan.
    if (e.button !== 0) return;
    e.stopPropagation();
    const cell = cellFromPoint(e.point);
    if (!cell) return;

    const defId = resolvePlaceId();
    if (!defId) return;

    painting.current = true;
    painted.current = new Set();
    lastCell.current = cell;
    strokeRot.current = useGameStore.getState().build.rotation;
    setControlsEnabled(false);

    // Capture so we keep receiving moves even if the cursor leaves the plane.
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
    painted.current = new Set();
    setControlsEnabled(true);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // Swallow clicks so terrain / buildings underneath don't clear selection
    // or re-trigger placement after a drag.
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
        <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
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

export default BuildSnapPlane;
