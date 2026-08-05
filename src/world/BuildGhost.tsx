/**
 * Wildhaven — build ghost.
 *
 * A semi-transparent preview of the currently-selected buildable, snapped to
 * the hovered grid cell. It turns red when the placement would be illegal
 * (out of bounds or overlapping something), matching the store's `build.valid`.
 */

import { useGameStore } from "../store/gameStore";
import { getBuilding } from "../game/buildings";
import { footprintCenter } from "../game/simulation";

export function BuildGhost() {
  const active = useGameStore((s) => s.build.active);
  const tool = useGameStore((s) => s.build.tool);
  const selectedDefId = useGameStore((s) => s.build.selectedDefId);
  const rotation = useGameStore((s) => s.build.rotation);
  const valid = useGameStore((s) => s.build.valid);
  const hoverCell = useGameStore((s) => s.hoverCell);

  if (!active || !hoverCell) return null;

  // Fence / gate tools fall back to their default piece.
  const defId =
    selectedDefId ??
    (tool === "fence" ? "fence-segment" : tool === "gate" ? "habitat-gate" : undefined);
  if (!defId) return null;

  const def = getBuilding(defId);
  if (!def) return null;

  const center = footprintCenter(hoverCell, def, rotation);
  const rotated = rotation % 2 === 1;
  const w = rotated ? def.size[1] : def.size[0];
  const d = rotated ? def.size[0] : def.size[1];
  const color = valid ? "#8fd694" : "#e0655a";

  return (
    <group position={[center.x, 0, center.z]} rotation={[0, (rotation * Math.PI) / 2, 0]}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[w * 0.96, 1.5, Math.max(0.2, d * 0.96)]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.max(w, 0.96), Math.max(d, 0.96)]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default BuildGhost;
