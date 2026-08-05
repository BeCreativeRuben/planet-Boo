/**
 * Wildhaven — terrain layer.
 *
 * A large, mostly-flat grassy plane with subtle rolling height noise and
 * per-vertex colour variation. Placement / snap raycasts live on BuildSnapPlane
 * so fences always hit a flat grid; the terrain only clears selection when the
 * player clicks empty ground outside of build mode.
 */

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import { MAP_SIZE } from "../game/simulation";

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

      const edge = Math.max(Math.abs(x), Math.abs(z)) / (MAP_SIZE / 2);
      const height = (n - 0.5) * 0.9 * (0.35 + edge * 0.9);
      pos.setY(i, height);

      const c = grassA.clone().lerp(grassB, n);
      c.lerp(sand, Math.max(0, edge - 0.7) * 1.2);
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // BuildSnapPlane owns placement; terrain only clears selection.
    if (useGameStore.getState().build.active) return;
    e.stopPropagation();
    useGameStore.getState().selectEntity(null);
  };

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={handleClick}
      // While building, skip terrain hits so the flat snap plane always wins.
      raycast={buildActive ? () => {} : undefined}
    >
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      {buildActive && <BuildGridHelper />}
    </mesh>
  );
}

/** Faint cell grid visible while any build tool is armed. */
function BuildGridHelper() {
  return (
    <gridHelper
      args={[MAP_SIZE, MAP_SIZE, "#6b8f4e", "#5a7a42"]}
      position={[0, 0.08, 0]}
      raycast={() => {}}
    />
  );
}

export default Terrain;
