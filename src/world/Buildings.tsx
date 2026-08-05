/**
 * Wildhaven — buildings layer.
 *
 * Each buildable has a distinct low-poly silhouette so stalls, galleries,
 * clinics and enrichment read clearly from the orbit camera — not a sea of
 * identical warm boxes.
 */

import type { ThreeEvent } from "@react-three/fiber";

import { useGameStore } from "../store/gameStore";
import { getBuilding } from "../game/buildings";
import { shopOpenFactor } from "../game/economy";
import type { Building, BuildingDef } from "../game/types";

interface MeshProps {
  def: BuildingDef;
  w: number;
  d: number;
}

const mat = (color: string, roughness = 0.85, metalness = 0) => (
  <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
);

/* -------------------------------------------------------------------------- */
/*  Habitat                                                                   */
/* -------------------------------------------------------------------------- */

function FenceMesh({ def }: MeshProps) {
  const h = 1.2;
  return (
    <group>
      <mesh position={[0, h * 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.14, 0.1]} />
        {mat(def.color, 0.8)}
      </mesh>
      <mesh position={[0, h * 0.7, 0]} castShadow>
        <boxGeometry args={[0.92, 0.14, 0.1]} />
        {mat(def.color, 0.8)}
      </mesh>
      <mesh position={[0, h * 0.12, 0]} castShadow>
        <boxGeometry args={[0.92, 0.1, 0.1]} />
        {mat("#6a4a28", 0.85)}
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, h / 2 + 0.05, 0]} castShadow>
          <boxGeometry args={[0.12, h + 0.15, 0.2]} />
          {mat("#5a4024", 0.9)}
        </mesh>
      ))}
    </group>
  );
}

function GateMesh({ def }: MeshProps) {
  const h = 1.55;
  return (
    <group>
      {/* Side posts */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, h / 2, 0]} castShadow>
          <boxGeometry args={[0.16, h, 0.22]} />
          {mat("#4a381f", 0.9)}
        </mesh>
      ))}
      {/* Top lintel */}
      <mesh position={[0, h - 0.08, 0]} castShadow>
        <boxGeometry args={[0.95, 0.16, 0.24]} />
        {mat(def.color, 0.8)}
      </mesh>
      {/* Half-open door leaf */}
      <mesh position={[-0.18, h * 0.42, 0.12]} rotation={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.4, h * 0.75, 0.06]} />
        {mat("#6b5234", 0.75)}
      </mesh>
      {/* Latch */}
      <mesh position={[0.12, h * 0.45, 0.08]} castShadow>
        <boxGeometry args={[0.08, 0.12, 0.08]} />
        {mat("#c9a227", 0.4, 0.5)}
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scenery & enrichment                                                      */
/* -------------------------------------------------------------------------- */

function TreeMesh({ def }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 1.4, 6]} />
        {mat("#6b4a2b", 0.95)}
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.85, 8, 6]} />
        {mat(def.color, 0.9)}
      </mesh>
      <mesh position={[0.35, 2.15, 0.2]} castShadow>
        <sphereGeometry args={[0.5, 7, 5]} />
        {mat("#4f9142", 0.9)}
      </mesh>
      <mesh position={[-0.3, 2.05, -0.25]} castShadow>
        <sphereGeometry args={[0.45, 7, 5]} />
        {mat("#5fa34a", 0.9)}
      </mesh>
    </group>
  );
}

function RockMesh({ def, w, d }: MeshProps) {
  const r = Math.max(0.45, Math.min(w, d) * 0.45);
  return (
    <group>
      <mesh position={[0, r * 0.5, 0]} castShadow receiveShadow rotation={[0.25, 0.5, 0.15]}>
        <icosahedronGeometry args={[r, 0]} />
        {mat(def.color, 1)}
      </mesh>
      <mesh position={[r * 0.55, r * 0.28, r * 0.2]} castShadow rotation={[0.4, -0.3, 0.2]}>
        <icosahedronGeometry args={[r * 0.45, 0]} />
        {mat("#7a756c", 1)}
      </mesh>
    </group>
  );
}

function PathMesh({ def, w, d }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[w * 0.98, 0.06, d * 0.98]} />
        {mat(def.color, 0.98)}
      </mesh>
      <mesh position={[0, 0.055, 0]} receiveShadow>
        <boxGeometry args={[w * 0.2, 0.02, d * 0.98]} />
        {mat("#b8ae95", 0.95)}
      </mesh>
    </group>
  );
}

function WaterFeatureMesh({ def, w, d }: MeshProps) {
  const rw = w * 0.9;
  const rd = d * 0.9;
  return (
    <group>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[Math.min(rw, rd) * 0.48, Math.min(rw, rd) * 0.5, 0.16, 12]} />
        {mat("#6d5a3a", 1)}
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[Math.min(rw, rd) * 0.4, Math.min(rw, rd) * 0.4, 0.08, 12]} />
        <meshStandardMaterial
          color={def.color}
          roughness={0.12}
          metalness={0.25}
          transparent
          opacity={0.88}
        />
      </mesh>
      {/* Small fountain spout */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.35, 6]} />
        {mat("#8a7a5a", 0.8)}
      </mesh>
    </group>
  );
}

function PlungePoolMesh({ def, w, d }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[w * 0.95, 0.24, d * 0.95]} />
        {mat("#5a6a72", 0.9)}
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[w * 0.78, 0.12, d * 0.78]} />
        <meshStandardMaterial
          color={def.color}
          roughness={0.1}
          metalness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Ladder rails */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.55, d * 0.42]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 5]} />
          {mat("#c0c4c8", 0.35, 0.6)}
        </mesh>
      ))}
    </group>
  );
}

function BallMesh({ def }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.38, 0]} castShadow>
        <sphereGeometry args={[0.38, 14, 12]} />
        {mat(def.color, 0.45)}
      </mesh>
      <mesh position={[0, 0.38, 0]} rotation={[0.4, 0.2, 0]}>
        <torusGeometry args={[0.38, 0.04, 6, 16]} />
        {mat("#f2e6a0", 0.5)}
      </mesh>
    </group>
  );
}

function ScratchPostMesh({ def }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 1.4, 7]} />
        {mat(def.color, 0.9)}
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.7, 8]} />
        {mat("#c4a574", 0.95)}
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.12, 8]} />
        {mat("#5a4024", 0.85)}
      </mesh>
    </group>
  );
}

function NestBoxMesh({ def }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.7, 0.55]} />
        {mat(def.color, 0.85)}
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.55, 0.35, 4]} />
        {mat("#6b4a2b", 0.9)}
      </mesh>
      {/* Entrance hole */}
      <mesh position={[0, 0.42, 0.28]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 10]} />
        {mat("#2a2118", 1)}
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.2, 6]} />
        {mat("#5a4024", 0.9)}
      </mesh>
    </group>
  );
}

function ClimbFrameMesh({ def, w, d }: MeshProps) {
  const color = def.color;
  return (
    <group>
      {[
        [-w * 0.35, -d * 0.35],
        [w * 0.35, -d * 0.35],
        [-w * 0.35, d * 0.35],
        [w * 0.35, d * 0.35],
      ].map(([x, z], i) => (
        <mesh key={`p${i}`} position={[x, 0.85, z]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 1.7, 6]} />
          {mat(color, 0.85)}
        </mesh>
      ))}
      {[0.45, 0.95, 1.45].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[w * 0.75, 0.08, d * 0.75]} />
          {mat("#8a6230", 0.8)}
        </mesh>
      ))}
      {/* Rope diagonals */}
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, w * 0.9, 5]} />
        {mat("#d2b48c", 0.7)}
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*  Guest amenities                                                           */
/* -------------------------------------------------------------------------- */

function BenchMesh({ def }: MeshProps) {
  return (
    <group>
      {/* Seat */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.08, 0.35]} />
        {mat(def.color, 0.8)}
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.65, -0.14]} castShadow>
        <boxGeometry args={[0.9, 0.4, 0.07]} />
        {mat(def.color, 0.8)}
      </mesh>
      {/* Legs */}
      {[-0.32, 0.32].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.2, 0.1]} castShadow>
            <boxGeometry args={[0.07, 0.4, 0.07]} />
            {mat("#5a4024", 0.9)}
          </mesh>
          <mesh position={[x, 0.2, -0.1]} castShadow>
            <boxGeometry args={[0.07, 0.4, 0.07]} />
            {mat("#5a4024", 0.9)}
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TrashBinMesh({ def, fillLevel = 0 }: MeshProps & { fillLevel?: number }) {
  const fill = Math.max(0, Math.min(100, fillLevel)) / 100;
  const trashH = 0.08 + fill * 0.55;
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.8, 10]} />
        {mat(def.color, 0.7)}
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.3, 0.1, 10]} />
        {mat("#2a3d30", 0.6)}
      </mesh>
      <mesh position={[0, 0.55, 0.3]} castShadow>
        <boxGeometry args={[0.2, 0.12, 0.04]} />
        {mat("#c9a227", 0.4, 0.4)}
      </mesh>
      {fill > 0.05 && (
        <mesh position={[0, 0.15 + trashH / 2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.24, trashH, 8]} />
          {mat(fill > 0.85 ? "#5a4030" : "#7a6a4a", 0.95)}
        </mesh>
      )}
      {fill >= 0.95 && (
        <mesh position={[0.12, 0.95, 0.05]} castShadow>
          <boxGeometry args={[0.16, 0.06, 0.12]} />
          {mat("#8a7050", 0.9)}
        </mesh>
      )}
    </group>
  );
}

function InfoBoardMesh({ def }: MeshProps) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 1.4, 6]} />
        {mat("#5a4024", 0.9)}
      </mesh>
      <mesh position={[0, 1.35, 0.04]} castShadow>
        <boxGeometry args={[0.85, 0.55, 0.06]} />
        {mat(def.color, 0.85)}
      </mesh>
      <mesh position={[0, 1.35, 0.08]}>
        <boxGeometry args={[0.7, 0.4, 0.02]} />
        {mat("#e8e0c8", 0.95)}
      </mesh>
      {/* Header bar */}
      <mesh position={[0, 1.58, 0.08]}>
        <boxGeometry args={[0.72, 0.08, 0.03]} />
        {mat("#3d6a4f", 0.7)}
      </mesh>
    </group>
  );
}

function StallAwning({ color, w, d, y }: { color: string; w: number; d: number; y: number }) {
  return (
    <group>
      <mesh position={[0, y, d * 0.15]} castShadow>
        <boxGeometry args={[w * 0.95, 0.06, d * 0.7]} />
        {mat(color, 0.75)}
      </mesh>
      <mesh position={[0, y - 0.15, d * 0.42]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[w * 0.95, 0.05, d * 0.35]} />
        {mat(color, 0.75)}
      </mesh>
    </group>
  );
}

function FoodStallMesh({ def, w, d }: MeshProps) {
  const bodyH = 1.35;
  return (
    <group>
      <mesh position={[0, bodyH / 2, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.85, bodyH, d * 0.55]} />
        {mat(def.color, 0.85)}
      </mesh>
      {/* Counter */}
      <mesh position={[0, 0.85, 0.35]} castShadow>
        <boxGeometry args={[w * 0.9, 0.12, 0.35]} />
        {mat("#5a4024", 0.8)}
      </mesh>
      <StallAwning color="#e0655a" w={w} d={d} y={1.55} />
      {/* Food cue — stacked trays */}
      <mesh position={[-0.25, 1.05, 0.35]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 8]} />
        {mat("#f2c14e", 0.5)}
      </mesh>
      <mesh position={[0.2, 1.08, 0.32]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.18]} />
        {mat("#8b4513", 0.7)}
      </mesh>
    </group>
  );
}

function DrinkStallMesh({ def, w, d }: MeshProps) {
  const bodyH = 1.4;
  return (
    <group>
      <mesh position={[0, bodyH / 2, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.8, bodyH, d * 0.55]} />
        {mat(def.color, 0.8)}
      </mesh>
      <StallAwning color="#3db8c4" w={w} d={d} y={1.6} />
      {/* Cooler cylinder */}
      <mesh position={[0.35, 0.7, 0.35]} castShadow>
        <cylinderGeometry args={[0.28, 0.3, 1.2, 10]} />
        {mat("#1a6a78", 0.4, 0.3)}
      </mesh>
      <mesh position={[0.35, 1.35, 0.35]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 0.12, 10]} />
        {mat("#c9e8f0", 0.3, 0.2)}
      </mesh>
      {/* Cup on counter */}
      <mesh position={[-0.25, 0.95, 0.4]} castShadow>
        <cylinderGeometry args={[0.08, 0.06, 0.18, 8]} />
        {mat("#f0f4f8", 0.5)}
      </mesh>
    </group>
  );
}

function GiftShopMesh({ def, w, d }: MeshProps) {
  const bodyH = 2.2;
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.88, bodyH, d * 0.88]} />
        {mat(def.color, 0.85)}
      </mesh>
      {/* Roof */}
      <mesh position={[0, bodyH + 0.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.7, 0.9, 4]} />
        {mat("#8b3a2a", 0.9)}
      </mesh>
      {/* Display windows */}
      {[-w * 0.22, w * 0.22].map((x) => (
        <mesh key={x} position={[x, 1.1, d * 0.44]}>
          <boxGeometry args={[w * 0.28, 0.9, 0.05]} />
          {mat("#a8d4e8", 0.2, 0.4)}
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[0, 0.7, d * 0.44]}>
        <boxGeometry args={[0.55, 1.3, 0.06]} />
        {mat("#5a3a22", 0.8)}
      </mesh>
      {/* Gift bow accent on roof */}
      <mesh position={[0, bodyH + 0.55, 0]} castShadow>
        <sphereGeometry args={[0.25, 8, 6]} />
        {mat("#e0655a", 0.5)}
      </mesh>
      <mesh position={[0, bodyH + 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.28, 0.05, 6, 12]} />
        {mat("#f2c14e", 0.45)}
      </mesh>
    </group>
  );
}

function ToiletMesh({ def, w, d }: MeshProps) {
  const bodyH = 1.8;
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, bodyH, d * 0.85]} />
        {mat(def.color, 0.85)}
      </mesh>
      <mesh position={[0, bodyH + 0.08, 0]} castShadow>
        <boxGeometry args={[w * 0.95, 0.12, d * 0.9]} />
        {mat("#4a5a68", 0.8)}
      </mesh>
      {/* Twin doors */}
      {[-0.35, 0.35].map((x) => (
        <mesh key={x} position={[x, 0.75, d * 0.42]}>
          <boxGeometry args={[0.5, 1.4, 0.05]} />
          {mat("#3d5060", 0.75)}
        </mesh>
      ))}
      {/* WC plate */}
      <mesh position={[0, 1.55, d * 0.44]}>
        <boxGeometry args={[0.45, 0.25, 0.04]} />
        {mat("#e8eef2", 0.6)}
      </mesh>
    </group>
  );
}

function ViewingGalleryMesh({ def, w, d }: MeshProps) {
  return (
    <group>
      {/* Deck */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.95, 0.12, d * 0.9]} />
        {mat(def.color, 0.85)}
      </mesh>
      {/* Posts */}
      {[
        [-w * 0.4, -d * 0.35],
        [w * 0.4, -d * 0.35],
        [-w * 0.4, d * 0.35],
        [w * 0.4, d * 0.35],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.42, z]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.85, 6]} />
          {mat("#5a4024", 0.9)}
        </mesh>
      ))}
      {/* Railings */}
      <mesh position={[0, 1.25, d * 0.4]} castShadow>
        <boxGeometry args={[w * 0.9, 0.08, 0.06]} />
        {mat("#6b5234", 0.8)}
      </mesh>
      <mesh position={[0, 1.25, -d * 0.4]} castShadow>
        <boxGeometry args={[w * 0.9, 0.08, 0.06]} />
        {mat("#6b5234", 0.8)}
      </mesh>
      {[-w * 0.42, w * 0.42].map((x) => (
        <mesh key={x} position={[x, 1.25, 0]} castShadow>
          <boxGeometry args={[0.06, 0.08, d * 0.85]} />
          {mat("#6b5234", 0.8)}
        </mesh>
      ))}
      {/* Stairs */}
      <mesh position={[0, 0.25, d * 0.55]} castShadow>
        <boxGeometry args={[w * 0.4, 0.5, 0.35]} />
        {mat("#8a6a40", 0.85)}
      </mesh>
      {/* Binocular stand */}
      <mesh position={[0.4, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.7, 6]} />
        {mat("#444", 0.4, 0.5)}
      </mesh>
      <mesh position={[0.4, 1.75, 0]} rotation={[0.3, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.35, 8]} />
        {mat("#2a2a2a", 0.3, 0.6)}
      </mesh>
    </group>
  );
}

function EntranceArchMesh({ def, w }: MeshProps) {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const open = shopOpenFactor(timeOfDay, 100) > 0;
  const h = 3.2;
  // Gates swing closed at night (rotate toward the opening).
  const gateAngle = open ? 0.95 : 0.08;
  return (
    <group>
      {[-w * 0.38, w * 0.38].map((x) => (
        <mesh key={x} position={[x, h / 2, 0]} castShadow>
          <boxGeometry args={[0.55, h, 0.55]} />
          {mat(def.color, 0.85)}
        </mesh>
      ))}
      <mesh position={[0, h - 0.2, 0]} castShadow>
        <boxGeometry args={[w * 0.9, 0.45, 0.6]} />
        {mat("#2d5a40", 0.8)}
      </mesh>
      {/* Sign banner */}
      <mesh position={[0, h - 0.2, 0.32]}>
        <boxGeometry args={[w * 0.7, 0.3, 0.05]} />
        {mat("#c9a227", 0.5)}
      </mesh>
      {/* Ticket booth */}
      <mesh position={[-w * 0.15, 0.7, 0.5]} castShadow>
        <boxGeometry args={[1.1, 1.4, 0.9]} />
        {mat("#5a7a4a", 0.85)}
      </mesh>
      <mesh position={[-w * 0.15, 1.15, 0.96]}>
        <boxGeometry args={[0.7, 0.4, 0.05]} />
        {mat("#a8d4e8", 0.2, 0.3)}
      </mesh>
      {/* Swinging gate leaves */}
      <group position={[-w * 0.22, 0, 0.05]} rotation={[0, gateAngle, 0]}>
        <mesh position={[0.55, 1.05, 0]} castShadow>
          <boxGeometry args={[1.1, 2.0, 0.08]} />
          {mat("#3d2814", 0.85)}
        </mesh>
      </group>
      <group position={[w * 0.22, 0, 0.05]} rotation={[0, -gateAngle, 0]}>
        <mesh position={[-0.55, 1.05, 0]} castShadow>
          <boxGeometry args={[1.1, 2.0, 0.08]} />
          {mat("#3d2814", 0.85)}
        </mesh>
      </group>
      {!open && (
        <mesh position={[0, 1.6, 0.4]}>
          <boxGeometry args={[1.4, 0.35, 0.06]} />
          {mat("#8a3030", 0.7)}
        </mesh>
      )}
    </group>
  );
}

function ParkingLotMesh({ def, w, d }: MeshProps) {
  const guestCount = useGameStore((s) => s.stats.guestCount);
  const cars = Math.min(14, Math.max(2, Math.round(guestCount / 8)));
  const stallsX = 6;
  const stallsZ = 2;
  const carColors = ["#c45c48", "#3d6a9a", "#d9c56a", "#4a4a52", "#6a8f5a", "#8a5a3a"];
  // Raised slab so bumpy terrain doesn't swallow the asphalt.
  const padH = 0.22;
  const padY = padH / 2;
  const surfaceY = padH + 0.01;
  return (
    <group>
      {/* Asphalt pad */}
      <mesh position={[0, padY, 0]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.98, padH, d * 0.98]} />
        {mat(def.color, 0.95)}
      </mesh>
      {/* Curb / apron */}
      <mesh position={[0, padH * 0.35, 0]} receiveShadow>
        <boxGeometry args={[w * 1.02, padH * 0.45, d * 1.02]} />
        {mat("#4a4e54", 0.92)}
      </mesh>
      {/* Lane stripe */}
      <mesh position={[0, surfaceY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.18, d * 0.85]} />
        {mat("#d9c56a", 0.7)}
      </mesh>
      {/* Stall lines */}
      {Array.from({ length: stallsX + 1 }, (_, i) => {
        const x = -w * 0.42 + (i / stallsX) * w * 0.84;
        return (
          <mesh key={`sx-${i}`} position={[x, surfaceY, -d * 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.06, d * 0.32]} />
            {mat("#e8e4d8", 0.6)}
          </mesh>
        );
      })}
      {Array.from({ length: stallsX + 1 }, (_, i) => {
        const x = -w * 0.42 + (i / stallsX) * w * 0.84;
        return (
          <mesh key={`sz-${i}`} position={[x, surfaceY, d * 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.06, d * 0.32]} />
            {mat("#e8e4d8", 0.6)}
          </mesh>
        );
      })}
      {/* Parked cars (fill with daytime crowd) */}
      {Array.from({ length: cars }, (_, i) => {
        const col = i % stallsX;
        const row = Math.floor(i / stallsX) % stallsZ;
        const x = -w * 0.35 + (col / Math.max(1, stallsX - 1)) * w * 0.7;
        const z = row === 0 ? -d * 0.22 : d * 0.22;
        return (
          <group key={i} position={[x, surfaceY + 0.22, z]}>
            <mesh castShadow>
              <boxGeometry args={[0.9, 0.35, 0.45]} />
              {mat(carColors[i % carColors.length]!, 0.55, 0.25)}
            </mesh>
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[0.55, 0.28, 0.4]} />
              {mat("#9ec4d8", 0.25, 0.35)}
            </mesh>
          </group>
        );
      })}
      {/* Ticket / attendant booth */}
      <mesh position={[w * 0.38, surfaceY + 0.55, -d * 0.35]} castShadow>
        <boxGeometry args={[0.7, 1.1, 0.7]} />
        {mat("#6a7a4a", 0.85)}
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*  Staff                                                                     */
/* -------------------------------------------------------------------------- */

function KeeperHutMesh({ def, w, d }: MeshProps) {
  const bodyH = 1.6;
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, bodyH, d * 0.9]} />
        {mat(def.color, 0.9)}
      </mesh>
      <mesh position={[0, bodyH + 0.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.72, 0.85, 4]} />
        {mat("#5a3a1e", 0.95)}
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.65, d * 0.45]}>
        <boxGeometry args={[0.5, 1.15, 0.06]} />
        {mat("#3d2814", 0.85)}
      </mesh>
      {/* Window */}
      <mesh position={[w * 0.28, 1.05, d * 0.45]}>
        <boxGeometry args={[0.35, 0.35, 0.05]} />
        {mat("#c9e0a0", 0.3, 0.2)}
      </mesh>
      {/* Chimney */}
      <mesh position={[w * 0.25, bodyH + 0.55, -d * 0.15]} castShadow>
        <boxGeometry args={[0.28, 0.7, 0.28]} />
        {mat("#6a5a4a", 0.9)}
      </mesh>
      {/* Feed crates outside */}
      <mesh position={[-w * 0.55, 0.25, 0.2]} castShadow>
        <boxGeometry args={[0.4, 0.35, 0.4]} />
        {mat("#8a6230", 0.85)}
      </mesh>
    </group>
  );
}

function VetClinicMesh({ def, w, d }: MeshProps) {
  const bodyH = 2.0;
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, bodyH, d * 0.9]} />
        {mat(def.color, 0.75)}
      </mesh>
      <mesh position={[0, bodyH + 0.12, 0]} castShadow>
        <boxGeometry args={[w * 0.95, 0.2, d * 0.95]} />
        {mat("#3d7fa6", 0.7)}
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.85, d * 0.45]}>
        <boxGeometry args={[0.7, 1.5, 0.06]} />
        {mat("#2f6a8a", 0.7)}
      </mesh>
      {/* Windows */}
      {[-w * 0.28, w * 0.28].map((x) => (
        <mesh key={x} position={[x, 1.3, d * 0.45]}>
          <boxGeometry args={[0.45, 0.5, 0.05]} />
          {mat("#d0eaf5", 0.2, 0.35)}
        </mesh>
      ))}
      {/* Medical cross */}
      <mesh position={[0, bodyH + 0.55, 0]} castShadow>
        <boxGeometry args={[0.55, 0.18, 0.12]} />
        {mat("#e0655a", 0.5)}
      </mesh>
      <mesh position={[0, bodyH + 0.55, 0]} castShadow>
        <boxGeometry args={[0.18, 0.55, 0.12]} />
        {mat("#e0655a", 0.5)}
      </mesh>
    </group>
  );
}

/** Fallback for anything without a bespoke mesh. */
function FacilityMesh({ def, w, d }: MeshProps) {
  const bodyH = Math.min(3, 1 + Math.min(w, d) * 0.35);
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, bodyH, d * 0.9]} />
        {mat(def.color, 0.85)}
      </mesh>
      <mesh position={[0, bodyH + 0.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.72, 0.7, 4]} />
        {mat("#7a4a2e", 0.9)}
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dispatch                                                                  */
/* -------------------------------------------------------------------------- */

function BuildingMesh({
  def,
  w,
  d,
  fillLevel,
}: MeshProps & { fillLevel?: number }) {
  switch (def.id) {
    case "fence-segment":
      return <FenceMesh def={def} w={w} d={d} />;
    case "habitat-gate":
      return <GateMesh def={def} w={w} d={d} />;
    case "tree":
      return <TreeMesh def={def} w={w} d={d} />;
    case "rock":
      return <RockMesh def={def} w={w} d={d} />;
    case "path":
      return <PathMesh def={def} w={w} d={d} />;
    case "water-feature":
      return <WaterFeatureMesh def={def} w={w} d={d} />;
    case "enrichment-pool":
      return <PlungePoolMesh def={def} w={w} d={d} />;
    case "enrichment-ball":
      return <BallMesh def={def} w={w} d={d} />;
    case "scratch-post":
      return <ScratchPostMesh def={def} w={w} d={d} />;
    case "nest-box":
      return <NestBoxMesh def={def} w={w} d={d} />;
    case "climb-frame":
      return <ClimbFrameMesh def={def} w={w} d={d} />;
    case "bench":
      return <BenchMesh def={def} w={w} d={d} />;
    case "trash-bin":
      return <TrashBinMesh def={def} w={w} d={d} fillLevel={fillLevel} />;
    case "info-board":
      return <InfoBoardMesh def={def} w={w} d={d} />;
    case "food-stall":
      return <FoodStallMesh def={def} w={w} d={d} />;
    case "drink-stall":
      return <DrinkStallMesh def={def} w={w} d={d} />;
    case "gift-shop":
      return <GiftShopMesh def={def} w={w} d={d} />;
    case "toilet":
      return <ToiletMesh def={def} w={w} d={d} />;
    case "viewing-gallery":
      return <ViewingGalleryMesh def={def} w={w} d={d} />;
    case "entrance-arch":
      return <EntranceArchMesh def={def} w={w} d={d} />;
    case "parking-lot":
      return <ParkingLotMesh def={def} w={w} d={d} />;
    case "keeper-hut":
      return <KeeperHutMesh def={def} w={w} d={d} />;
    case "vet-clinic":
      return <VetClinicMesh def={def} w={w} d={d} />;
    default:
      return <FacilityMesh def={def} w={w} d={d} />;
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
      raycast={placing ? () => {} : undefined}
    >
      <BuildingMesh def={def} w={w} d={d} fillLevel={building.fillLevel} />
    </group>
  );
}

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
