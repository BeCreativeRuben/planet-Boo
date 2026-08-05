/**
 * Wildhaven — terrain layer.
 *
 * A large, mostly-flat grassy plane with subtle rolling height noise and
 * per-vertex colour variation (greens fading to sandy tan). It also owns the
 * ground raycast: pointer moves update the build-ghost hover cell, and clicks
 * either place a building, drop an adopted animal into a habitat, or clear the
 * current selection.
 */

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import { MAP_SIZE, worldToCell, inBounds } from "../game/simulation";
import type { Vec2 } from "../game/types";

const SEGMENTS = 96;

/** Cheap value-noise-ish hash for gentle, repeatable terrain undulation. */
function noise2(x: number, z: number): number {
  const s = Math.sin(x * 0.15) * Math.cos(z * 0.13);
  const s2 = Math.sin(x * 0.05 + z * 0.07);
  return (s * 0.6 + s2 * 0.4) * 0.5 + 0.5; // 0..1
}

export function Terrain() {
  const buildActive = useGameStore((s) => s.build.active);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      MAP_SIZE,
      MAP_SIZE,
      SEGMENTS,
      SEGMENTS,
    );
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];

    const grassA = new THREE.Color("#6f9a45");
    const grassB = new THREE.Color("#557d38");
    const sand = new THREE.Color("#cdbb84");

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = noise2(x, z);

      // Subtle height: a few decimetres of roll, flattened toward the centre
      // so the buildable park stays level.
      const edge = Math.max(Math.abs(x), Math.abs(z)) / (MAP_SIZE / 2);
      const height = (n - 0.5) * 0.9 * (0.35 + edge * 0.9);
      pos.setY(i, height);

      // Colour: blend two greens by noise, drift to sand near the edges.
      const c = grassA.clone().lerp(grassB, n);
      c.lerp(sand, Math.max(0, edge - 0.7) * 1.2);
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const cellFromEvent = (e: ThreeEvent<PointerEvent | MouseEvent>): Vec2 | null => {
    const cx = worldToCell(e.point.x);
    const cz = worldToCell(e.point.z);
    if (!inBounds(cx) || !inBounds(cz)) return null;
    return { x: cx, z: cz };
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (!buildActive) return;
    const cell = cellFromEvent(e);
    useGameStore.getState().setHoverCell(cell);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const store = useGameStore.getState();
    const { build } = store;

    if (!build.active) {
      store.selectEntity(null);
      return;
    }

    const cell = cellFromEvent(e);
    if (!cell) return;

    // Fence / gate tools imply their default piece; the place tool uses the
    // currently selected buildable.
    const placeId =
      build.tool === "fence"
        ? build.selectedDefId ?? "fence-segment"
        : build.tool === "gate"
          ? build.selectedDefId ?? "habitat-gate"
          : build.tool === "place"
            ? build.selectedDefId
            : undefined;

    if (placeId) {
      store.placeBuilding(placeId, cell, build.rotation);
    } else if (build.tool === "animal" && build.selectedSpeciesId) {
      // Drop the adopted animal into whichever habitat contains this cell.
      const worldX = cell.x - MAP_SIZE / 2 + 0.5;
      const worldZ = cell.z - MAP_SIZE / 2 + 0.5;
      const habitat = Object.values(store.habitats).find(
        (h) =>
          worldX >= h.bounds.min.x &&
          worldX <= h.bounds.max.x &&
          worldZ >= h.bounds.min.z &&
          worldZ <= h.bounds.max.z,
      );
      if (habitat) {
        store.addAnimalToHabitat(build.selectedSpeciesId, habitat.id);
      }
    } else {
      store.selectEntity(null);
    }
  };

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onPointerMove={handleMove}
      onPointerOut={() => useGameStore.getState().setHoverCell(null)}
      onClick={handleClick}
    >
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}

export default Terrain;
