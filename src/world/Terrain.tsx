/**
 * Wildhaven — terrain layer.
 *
 * One grass patch per owned land parcel. Expands when the player buys plots.
 * Placement raycasts live on BuildSnapPlane; terrain only clears selection.
 */

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import {
  PARCEL_SIZE,
  ownedExtent,
  parcelWorldCenter,
  parseParcelKey,
} from "../game/parcels";

const SEGMENTS = 24;

function noise2(x: number, z: number): number {
  const s = Math.sin(x * 0.15) * Math.cos(z * 0.13);
  const s2 = Math.sin(x * 0.05 + z * 0.07);
  return (s * 0.6 + s2 * 0.4) * 0.5 + 0.5;
}

function ParcelGrass({ px, pz }: { px: number; pz: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(PARCEL_SIZE, PARCEL_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const grassA = new THREE.Color("#6f9a45");
    const grassB = new THREE.Color("#557d38");
    const sand = new THREE.Color("#cbb887");
    const center = parcelWorldCenter(px, pz);
    const half = PARCEL_SIZE / 2;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = lx + center.x;
      const wz = lz + center.z;
      const n = noise2(wx, wz);
      const edge = Math.max(Math.abs(lx), Math.abs(lz)) / half;
      pos.setY(i, (n - 0.5) * 0.55 * (0.35 + edge * 0.7));
      const c = grassA.clone().lerp(grassB, n);
      c.lerp(sand, Math.max(0, edge - 0.78) * 1.4);
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [px, pz]);

  const center = parcelWorldCenter(px, pz);

  return (
    <mesh
      geometry={geometry}
      position={[center.x, 0, center.z]}
      receiveShadow
      raycast={() => {}}
    >
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}

export function Terrain() {
  const buildActive = useGameStore((s) => s.build.active);
  const ownedKey = useGameStore((s) => s.ownedParcels.join("|"));
  const ownedParcels = useGameStore((s) => s.ownedParcels);
  const extent = useMemo(() => ownedExtent(ownedParcels), [ownedKey, ownedParcels]);

  const parcels = useMemo(
    () => ownedParcels.map((k) => parseParcelKey(k)),
    [ownedKey, ownedParcels],
  );

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (useGameStore.getState().build.active) return;
    e.stopPropagation();
    useGameStore.getState().selectEntity(null);
  };

  return (
    <group onClick={handleClick}>
      {/* Wilderness underlay so holes / edges read as wild ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow raycast={() => {}}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#5c7348" roughness={1} />
      </mesh>

      {parcels.map(({ px, pz }) => (
        <ParcelGrass key={`${px},${pz}`} px={px} pz={pz} />
      ))}

      {buildActive && (
        <gridHelper
          args={[extent.plotSize, Math.max(8, Math.round(extent.plotSize)), "#6b8f4e", "#5a7a42"]}
          position={[extent.cx, 0.08, extent.cz]}
          raycast={() => {}}
        />
      )}
    </group>
  );
}

export default Terrain;
