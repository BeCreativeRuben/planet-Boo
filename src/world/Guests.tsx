/**
 * Wildhaven — guests layer.
 *
 * Capsule people who stroll in families, pause to watch animals, and face
 * their look direction. Positions / facing are read live in useFrame.
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
        s.build.tool === "claim" ||
        s.build.tool === "animal"),
  );

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const guest = useGameStore.getState().guests[id];
    if (!guest) return;
    g.position.x = guest.position.x;
    g.position.z = guest.position.z;
    // Facing is atan2(dx, dz) — match Three.js Y rotation.
    g.rotation.y = guest.facing ?? 0;
    const t = state.clock.elapsedTime;
    const viewing = guest.activity === "view";
    // Quiet bob while watching; walk bob while moving.
    g.position.y = viewing
      ? Math.sin(t * 1.6 + phase) * 0.012
      : Math.abs(Math.sin(t * 5.2 + phase)) * 0.05;
  });

  const guest = useGameStore.getState().guests[id];
  const child = guest?.kind === "child";
  const scale = child ? 0.72 : 1;

  return (
    <group ref={ref} scale={scale} raycast={placing ? () => {} : undefined}>
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
