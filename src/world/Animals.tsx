/**
 * Wildhaven — animals layer.
 *
 * Each animal is a stylised low-poly creature (ellipsoid body, head, four
 * stubby legs, tail) tinted by its species colour. A gentle idle bob and a
 * heading-based facing give them life without any skeletal animation. Clicking
 * selects the animal and asks the camera to focus it.
 *
 * Performance: the layer subscribes only to the *set* of animal ids (which
 * changes rarely), and each mesh reads its live position from the store inside
 * useFrame — so per-frame simulation updates don't trigger React re-renders.
 */

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import { SPECIES_BY_ID } from "../game/species";
import { getAnimalHeading, hash01 } from "../game/simulation";
import type { AnimalSizeClass } from "../game/types";

/** Rough body scale (in metres) per size class. */
const SIZE_SCALE: Record<AnimalSizeClass, number> = {
  small: 0.55,
  medium: 0.9,
  large: 1.3,
  huge: 1.9,
};

function AnimalMesh({ id }: { id: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const selected = useGameStore(
    (s) => s.selection?.kind === "animal" && s.selection.id === id,
  );

  // Species is immutable for the animal's lifetime — read once.
  const speciesId = useGameStore.getState().animals[id]?.speciesId;
  const def = speciesId ? SPECIES_BY_ID[speciesId] : undefined;
  const scale = SIZE_SCALE[def?.size ?? "medium"];
  const color = def?.color ?? "#b08d57";
  const legColor = useMemo(
    () => `#${new THREE.Color(color).multiplyScalar(0.8).getHexString()}`,
    [color],
  );
  const phase = hash01(id) * Math.PI * 2;

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const animal = useGameStore.getState().animals[id];
    if (!animal) return;
    g.position.x = animal.position.x;
    g.position.z = animal.position.z;
    const t = state.clock.elapsedTime;
    g.position.y = Math.abs(Math.sin(t * 2 + phase)) * 0.05 * scale;
    const heading = getAnimalHeading(id);
    g.rotation.y = -heading + Math.PI / 2;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const store = useGameStore.getState();
    if (store.build.active) return;
    store.selectEntity({ kind: "animal", id });
    store.focusAnimal(id);
  };

  const placing = useGameStore(
    (s) =>
      s.build.active &&
      (s.build.tool === "place" || s.build.tool === "fence" || s.build.tool === "gate"),
  );

  const bodyLen = 1.2 * scale;
  const bodyR = 0.5 * scale;
  const legH = 0.5 * scale;
  const legOff = 0.32 * scale;

  return (
    <group ref={groupRef} onClick={onClick} raycast={placing ? () => {} : undefined}>
      <mesh position={[0, legH + bodyR * 0.6, 0]} scale={[bodyLen, bodyR, bodyR]} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[bodyLen * 0.75, legH + bodyR * 1.05, 0]} scale={scale} castShadow>
        <sphereGeometry args={[0.42, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[bodyLen * 0.95, legH + bodyR * 0.85, 0]} scale={scale} castShadow>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color={legColor} roughness={0.85} />
      </mesh>
      <mesh position={[-bodyLen * 0.9, legH + bodyR * 0.7, 0]} rotation={[0, 0, 0.5]} scale={scale} castShadow>
        <cylinderGeometry args={[0.05, 0.1, 0.7, 5]} />
        <meshStandardMaterial color={legColor} roughness={0.85} />
      </mesh>
      {[
        [legOff, legOff],
        [legOff, -legOff],
        [-legOff, legOff],
        [-legOff, -legOff],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx * 2, legH / 2, lz * 2]} castShadow>
          <cylinderGeometry args={[0.12 * scale, 0.12 * scale, legH, 6]} />
          <meshStandardMaterial color={legColor} roughness={0.85} />
        </mesh>
      ))}
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[bodyLen * 1.15, bodyLen * 1.45, 28]} />
          <meshBasicMaterial color="#c9a227" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export function Animals() {
  const ids = useGameStore((s) => Object.keys(s.animals).join(","));
  const list = ids ? ids.split(",") : [];
  return (
    <group>
      {list.map((id) => (
        <AnimalMesh key={id} id={id} />
      ))}
    </group>
  );
}

export default Animals;
