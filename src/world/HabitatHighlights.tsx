/**
 * Wildhaven — habitat highlights.
 *
 * Soft, translucent coloured planes laid over each habitat's footprint. They
 * fade in when a habitat is selected or when the player is dropping an animal,
 * so it is obvious where a creature will land.
 */

import type { Biome } from "../game/types";
import { useGameStore } from "../store/gameStore";

const BIOME_TINT: Record<Biome, string> = {
  savanna: "#d9b34a",
  forest: "#4f9142",
  wetland: "#3d9aa6",
  desert: "#d99a5a",
  arctic: "#9fc9e0",
  mountain: "#9aa0a6",
};

export function HabitatHighlights() {
  const habitats = useGameStore((s) => s.habitats);
  const selection = useGameStore((s) => s.selection);
  const tool = useGameStore((s) => s.build.tool);
  const buildActive = useGameStore((s) => s.build.active);

  const showAll = buildActive && (tool === "animal" || tool === "claim");

  return (
    <group>
      {Object.values(habitats).map((h) => {
        const isSelected = selection?.kind === "habitat" && selection.id === h.id;
        if (!showAll && !isSelected) return null;
        const cx = (h.bounds.min.x + h.bounds.max.x) / 2;
        const cz = (h.bounds.min.z + h.bounds.max.z) / 2;
        const w = Math.max(1, h.bounds.max.x - h.bounds.min.x);
        const d = Math.max(1, h.bounds.max.z - h.bounds.min.z);
        return (
          <mesh key={h.id} position={[cx, 0.06, cz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial
              color={BIOME_TINT[h.biome]}
              transparent
              opacity={isSelected ? 0.28 : 0.16}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default HabitatHighlights;
