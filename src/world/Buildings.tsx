/**
 * Wildhaven — buildings layer.
 *
 * Renders every placed {@link Building} as a stylised low-poly object whose
 * silhouette reflects its category: fences are thin timber walls, trees are
 * trunk+canopy, boulders are faceted rocks, paths are flat paved tiles, and
 * stalls/facilities are warm boxes with pitched roofs. Clicking selects a
 * building (or demolishes it when the delete tool is active).
 *
 * Each building is wrapped in a group placed at its world position and rotated
 * about Y; the individual meshes below are authored in *local* space.
 */

import type { ThreeEvent } from "@react-three/fiber";

import { useGameStore } from "../store/gameStore";
import { getBuilding } from "../game/buildings";
import type { Building, BuildingDef } from "../game/types";

/* -------------------------------------------------------------------------- */
/*  Individual building meshes (authored around the local origin)             */
/* -------------------------------------------------------------------------- */

interface MeshProps {
  def: BuildingDef;
  w: number;
  d: number;
}

function FenceMesh({ def }: MeshProps) {
  const gate = def.id === "habitat-gate";
  const h = gate ? 1.5 : 1.15;
  const postColor = gate ? "#4a381f" : "#5f4a2e";
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, h, 0.18]} />
        <meshStandardMaterial color={def.color} roughness={0.8} />
      </mesh>
      <mesh position={[-0.45, h / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[0.14, h + 0.2, 0.26]} />
        <meshStandardMaterial color={postColor} roughness={0.85} />
      </mesh>
      <mesh position={[0.45, h / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[0.14, h + 0.2, 0.26]} />
        <meshStandardMaterial color={postColor} roughness={0.85} />
      </mesh>
    </group>
  );
}

function TreeMesh({ def }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 1.2, 6]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[0.95, 1.6, 8]} />
        <meshStandardMaterial color={def.color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <coneGeometry args={[0.7, 1.2, 8]} />
        <meshStandardMaterial color="#4f9142" roughness={0.85} />
      </mesh>
    </group>
  );
}

function RockMesh({ def, w, d }: MeshProps) {
  const r = Math.max(0.5, Math.min(w, d) * 0.5);
  return (
    <mesh position={[0, r * 0.55, 0]} castShadow receiveShadow rotation={[0.3, 0.6, 0.2]}>
      <icosahedronGeometry args={[r, 0]} />
      <meshStandardMaterial color={def.color} flatShading roughness={1} />
    </mesh>
  );
}

function PathMesh({ def, w, d }: MeshProps) {
  return (
    <mesh position={[0, 0.03, 0]} receiveShadow>
      <boxGeometry args={[w * 0.98, 0.06, d * 0.98]} />
      <meshStandardMaterial color={def.color} roughness={0.95} />
    </mesh>
  );
}

function WaterMesh({ def, w, d }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[w * 0.98, 0.08, d * 0.98]} />
        <meshStandardMaterial color="#6d5a3a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[w * 0.8, 0.05, d * 0.8]} />
        <meshStandardMaterial
          color={def.color}
          roughness={0.15}
          metalness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

function BallMesh({ def }: MeshProps) {
  return (
    <mesh position={[0, 0.35, 0]} castShadow>
      <sphereGeometry args={[0.35, 12, 12]} />
      <meshStandardMaterial color={def.color} roughness={0.5} />
    </mesh>
  );
}

function PostMesh({ def }: MeshProps) {
  return (
    <mesh position={[0, 0.55, 0]} castShadow>
      <cylinderGeometry args={[0.12, 0.16, 1.1, 6]} />
      <meshStandardMaterial color={def.color} roughness={0.9} />
    </mesh>
  );
}

function FrameMesh({ def, w, d }: MeshProps) {
  const color = def.color;
  return (
    <group>
      {[
        [-w * 0.35, -d * 0.35],
        [w * 0.35, -d * 0.35],
        [-w * 0.35, d * 0.35],
        [w * 0.35, d * 0.35],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.6, z]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.2, 6]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[w * 0.8, 0.12, d * 0.8]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Generic warm box building with a pitched roof — stalls, shops, facilities. */
function FacilityMesh({ def, w, d }: MeshProps) {
  const bodyH = Math.min(3, 1 + Math.min(w, d) * 0.35);
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, bodyH, d * 0.9]} />
        <meshStandardMaterial color={def.color} roughness={0.85} />
      </mesh>
      <mesh position={[0, bodyH + 0.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.72, 0.7, 4]} />
        <meshStandardMaterial color="#7a4a2e" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Low prop for benches, bins and signs. */
function PropMesh({ def, w, d }: MeshProps) {
  return (
    <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
      <boxGeometry args={[w * 0.7, 0.6, d * 0.7]} />
      <meshStandardMaterial color={def.color} roughness={0.85} />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dispatch                                                                  */
/* -------------------------------------------------------------------------- */

const LOW_PROPS = new Set(["bench", "trash-bin", "info-board"]);

function BuildingMesh({ def, w, d }: MeshProps) {
  switch (def.id) {
    case "fence-segment":
    case "habitat-gate":
      return <FenceMesh def={def} w={w} d={d} />;
    case "tree":
      return <TreeMesh def={def} w={w} d={d} />;
    case "rock":
      return <RockMesh def={def} w={w} d={d} />;
    case "path":
      return <PathMesh def={def} w={w} d={d} />;
    case "water-feature":
    case "enrichment-pool":
      return <WaterMesh def={def} w={w} d={d} />;
    case "enrichment-ball":
      return <BallMesh def={def} w={w} d={d} />;
    case "scratch-post":
    case "nest-box":
      return <PostMesh def={def} w={w} d={d} />;
    case "climb-frame":
      return <FrameMesh def={def} w={w} d={d} />;
    default:
      return LOW_PROPS.has(def.id) ? (
        <PropMesh def={def} w={w} d={d} />
      ) : (
        <FacilityMesh def={def} w={w} d={d} />
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  One placed building                                                       */
/* -------------------------------------------------------------------------- */

function PlacedBuilding({ id }: { id: string }) {
  const building = useGameStore((s) => s.buildings[id]) as Building | undefined;
  const placing = useGameStore(
    (s) =>
      s.build.active &&
      (s.build.tool === "place" ||
        s.build.tool === "fence" ||
        s.build.tool === "gate" ||
        s.build.tool === "claim" ||
        s.build.tool === "animal"),
  );
  if (!building) return null;
  const def = getBuilding(building.defId);
  if (!def) return null;

  const rotated = building.rotation % 2 === 1;
  const w = rotated ? def.size[1] : def.size[0];
  const d = rotated ? def.size[0] : def.size[1];

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const store = useGameStore.getState();
    if (store.build.active && store.build.tool === "delete") {
      store.demolish(id);
    } else if (!store.build.active) {
      store.selectEntity({ kind: "building", id });
    }
  };

  return (
    <group
      position={[building.position.x, 0, building.position.z]}
      rotation={[0, (building.rotation * Math.PI) / 2, 0]}
      onClick={placing ? undefined : onClick}
      // While placing, let the snap plane receive all hits.
      raycast={placing ? () => {} : undefined}
    >
      <BuildingMesh def={def} w={w} d={d} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*  Layer                                                                     */
/* -------------------------------------------------------------------------- */

export function Buildings() {
  const ids = useGameStore((s) => Object.keys(s.buildings).join(","));
  const list = ids ? ids.split(",") : [];
  return (
    <group>
      {list.map((id) => (
        <PlacedBuilding key={id} id={id} />
      ))}
    </group>
  );
}

export default Buildings;
