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
import { RARITY_META, effectiveRarity, speciesRarity } from "../game/acquisition";
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
  const animal = useGameStore((s) => s.animals[id]);
  const selected = useGameStore(
    (s) => s.selection?.kind === "animal" && s.selection.id === id,
  );

  const speciesId = animal?.speciesId ?? "lion";
  const def = SPECIES_BY_ID[speciesId];
  const scale = SIZE_SCALE[def?.size ?? "medium"];
  const color = def?.color ?? "#b08d57";
  const phase = hash01(id) * Math.PI * 2;
  const ageRatio = animal ? animal.age / Math.max(1, animal.lifespan) : 0.35;
  const healthRatio = animal ? animal.health / 100 : 1;
  const rarity = animal
    ? effectiveRarity(def ?? SPECIES_BY_ID.lion!, animal.rarity)
    : speciesRarity(def ?? SPECIES_BY_ID.lion!);
  const rarityColor = RARITY_META[rarity].color;

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const live = useGameStore.getState().animals[id];
    if (!live) return;
    g.position.x = live.position.x;
    g.position.z = live.position.z;
    const t = state.clock.elapsedTime;
    const bob = live.health < 45 ? 0.02 : 0.04;
    g.position.y = Math.abs(Math.sin(t * 2.2 + phase)) * bob * scale;
    g.rotation.x = Math.sin(t * 2.2 + phase) * (live.health < 45 ? 0.05 : 0.03);
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
      (s.build.tool === "place" ||
        s.build.tool === "fence" ||
        s.build.tool === "gate" ||
        s.build.tool === "claim" ||
        s.build.tool === "animal"),
  );

  const ringR = 0.7 * scale;

  return (
    <group ref={groupRef} onClick={onClick} raycast={placing ? () => {} : undefined}>
      <AnimalForm
        speciesId={speciesId}
        color={color}
        s={scale}
        sex={animal?.sex}
        ageRatio={ageRatio}
        healthRatio={healthRatio}
        rarity={rarity}
        variantSeed={animal?.variantSeed ?? hash01(id)}
      />
      {rarity !== "common" && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringR * 0.95, ringR * 1.05, 24]} />
          <meshBasicMaterial color={rarityColor} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}
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
