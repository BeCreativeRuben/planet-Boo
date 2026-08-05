/**
 * Wildhaven — animals layer.
 *
 * Each animal uses a species-specific low-poly silhouette from AnimalForms,
 * with idle bob + heading. Click selects and focuses the camera.
 */

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import { SPECIES_BY_ID } from "../game/species";
import { getAnimalHeading, hash01 } from "../game/simulation";
import type { AnimalSizeClass } from "../game/types";
import { AnimalForm } from "./AnimalForms";

const SIZE_SCALE: Record<AnimalSizeClass, number> = {
  small: 0.7,
  medium: 1.0,
  large: 1.25,
  huge: 1.55,
};

function AnimalMesh({ id }: { id: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const selected = useGameStore(
    (s) => s.selection?.kind === "animal" && s.selection.id === id,
  );

  const speciesId = useGameStore.getState().animals[id]?.speciesId ?? "lion";
  const def = SPECIES_BY_ID[speciesId];
  const scale = SIZE_SCALE[def?.size ?? "medium"];
  const color = def?.color ?? "#b08d57";
  const phase = hash01(id) * Math.PI * 2;

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const animal = useGameStore.getState().animals[id];
    if (!animal) return;
    g.position.x = animal.position.x;
    g.position.z = animal.position.z;
    const t = state.clock.elapsedTime;
    // Gentle bob + tiny pitch so they feel alive while wandering.
    g.position.y = Math.abs(Math.sin(t * 2.2 + phase)) * 0.04 * scale;
    g.rotation.x = Math.sin(t * 2.2 + phase) * 0.03;
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

  const ringR = 0.7 * scale;

  return (
    <group ref={groupRef} onClick={onClick} raycast={placing ? () => {} : undefined}>
      <AnimalForm speciesId={speciesId} color={color} s={scale} />
      {selected && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringR * 1.1, ringR * 1.45, 28]} />
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
