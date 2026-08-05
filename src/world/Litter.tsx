/**
 * Wildhaven — ground litter piles left by guests.
 */

import { useGameStore } from "../store/gameStore";

function LitterPile({ id }: { id: string }) {
  const pile = useGameStore((s) => s.litter[id]);
  if (!pile) return null;
  const s = 0.18 + pile.amount * 0.06;
  return (
    <group position={[pile.position.x, 0.05, pile.position.z]}>
      <mesh castShadow>
        <boxGeometry args={[s, 0.08, s * 0.7]} />
        <meshStandardMaterial color="#6b5a3e" roughness={0.95} />
      </mesh>
      <mesh position={[s * 0.25, 0.06, -s * 0.1]} castShadow>
        <boxGeometry args={[s * 0.5, 0.05, s * 0.4]} />
        <meshStandardMaterial color="#8a7a58" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function LitterLayer() {
  const ids = useGameStore((s) => Object.keys(s.litter).join(","));
  const list = ids ? ids.split(",") : [];
  return (
    <group>
      {list.map((id) => (
        <LitterPile key={id} id={id} />
      ))}
    </group>
  );
}

export default LitterLayer;
