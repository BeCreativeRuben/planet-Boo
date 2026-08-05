/**
 * Wildhaven — terrain layer.
 *
 * Owned-plot grass with subtle height noise. Expands when the player buys land.
 * Placement raycasts live on BuildSnapPlane; terrain only clears selection.
 */

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";

const SEGMENTS = 96;

function noise2(x: number, z: number): number {
  const s = Math.sin(x * 0.15) * Math.cos(z * 0.13);
  const s2 = Math.sin(x * 0.05 + z * 0.07);
  return (s * 0.6 + s2 * 0.4) * 0.5 + 0.5;
}

export function Terrain() {
  const buildActive = useGameStore((s) => s.build.active);
  const plotSize = useGameStore((s) => s.plotSize);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(plotSize, plotSize, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const grassA = new THREE.Color("#6f9a45");
    const grassB = new THREE.Color("#557d38");
    const sand = new THREE.Color("#cbb887");
    const half = plotSize / 2;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = noise2(x, z);
      const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
      pos.setY(i, (n - 0.5) * 0.75 * (0.3 + edge * 0.85));
      const c = grassA.clone().lerp(grassB, n);
      c.lerp(sand, Math.max(0, edge - 0.72) * 1.3);
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [plotSize]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (useGameStore.getState().build.active) return;
    e.stopPropagation();
    useGameStore.getState().selectEntity(null);
  };

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={handleClick}
      raycast={buildActive ? () => {} : undefined}
    >
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      {buildActive && (
        <gridHelper
          args={[plotSize, plotSize, "#6b8f4e", "#5a7a42"]}
          position={[0, 0.08, 0]}
          raycast={() => {}}
        />
      )}
    </mesh>
  );
}

export default Terrain;
