/**
 * Wildhaven — guests layer.
 *
 * Small capsule people strolling the paths, each with a randomly varied
 * clothing colour and a subtle walking bob. Like the animals layer, this only
 * re-renders when the guest population changes; positions are read live inside
 * useFrame for performance with a crowd.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

import { useGameStore } from "../store/gameStore";
import { guestColor, hash01 } from "../game/simulation";

function GuestMesh({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const shirt = guestColor(id);
  const phase = hash01(id) * Math.PI * 2;
  const placing = useGameStore(
    (s) =>
      s.build.active &&
      (s.build.tool === "place" ||
        s.build.tool === "fence" ||
        s.build.tool === "gate" ||
        s.build.tool === "claim"),
  );

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const guest = useGameStore.getState().guests[id];
    if (!guest) return;
    g.position.x = guest.position.x;
    g.position.z = guest.position.z;
    const t = state.clock.elapsedTime;
    g.position.y = Math.abs(Math.sin(t * 6 + phase)) * 0.05;
  });

  return (
    <group ref={ref} raycast={placing ? () => {} : undefined}>
      {/* legs */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.56, 6]} />
        <meshStandardMaterial color="#3b3f4a" roughness={0.9} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.34, 4, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.85} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial color="#e8c9a8" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Guests() {
  const ids = useGameStore((s) => Object.keys(s.guests).join(","));
  const list = ids ? ids.split(",") : [];
  return (
    <group>
      {list.map((id) => (
        <GuestMesh key={id} id={id} />
      ))}
    </group>
  );
}

export default Guests;
