/**
 * Wildhaven — per-species low-poly silhouettes.
 *
 * Still deliberately simple (no skinned meshes), but each animal has a readable
 * silhouette: trunks, necks, manes, beaks, stripes-as-bands, etc.
 */

import { useMemo } from "react";
import * as THREE from "three";

function shade(hex: string, mul: number): string {
  return `#${new THREE.Color(hex).multiplyScalar(mul).getHexString()}`;
}

function Mat({ color, rough = 0.82 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} flatShading />;
}

function QuadLegs({
  y,
  spreadX,
  spreadZ,
  h,
  r,
  color,
}: {
  y: number;
  spreadX: number;
  spreadZ: number;
  h: number;
  r: number;
  color: string;
}) {
  const pts: [number, number][] = [
    [spreadX, spreadZ],
    [spreadX, -spreadZ],
    [-spreadX, spreadZ],
    [-spreadX, -spreadZ],
  ];
  return (
    <>
      {pts.map(([x, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <cylinderGeometry args={[r * 0.85, r, h, 6]} />
          <Mat color={color} />
        </mesh>
      ))}
    </>
  );
}

function Ears({
  y,
  z,
  color,
  size = 0.18,
  droop = false,
}: {
  y: number;
  z: number;
  color: string;
  size?: number;
  droop?: boolean;
}) {
  return (
    <>
      <mesh
        position={[0.12, y, z]}
        rotation={[droop ? 0.6 : -0.4, 0, 0.5]}
        castShadow
      >
        <sphereGeometry args={[size, 6, 5]} />
        <Mat color={color} />
      </mesh>
      <mesh
        position={[-0.12, y, z]}
        rotation={[droop ? 0.6 : -0.4, 0, -0.5]}
        castShadow
      >
        <sphereGeometry args={[size, 6, 5]} />
        <Mat color={color} />
      </mesh>
    </>
  );
}

/** Shared props for every form. */
export interface FormProps {
  color: string;
  s: number;
  sex?: "male" | "female";
  ageRatio?: number;
  healthRatio?: number;
  rarity?: import("../game/types").AnimalRarity;
  variantSeed?: number;
}

function tintColor(hex: string, seed = 0.5, mul = 1): string {
  const jitter = 0.88 + seed * 0.18;
  return shade(hex, mul * jitter);
}

export function AnimalForm({
  speciesId,
  color,
  s,
  sex,
  ageRatio = 0.35,
  healthRatio = 1,
  rarity = "common",
  variantSeed = 0.5,
}: FormProps & { speciesId: string }) {
  const bodyColor = tintColor(color, variantSeed);
  const juvenile = ageRatio < 0.18;
  const scale = s * (juvenile ? 0.72 : 1) * (healthRatio < 0.45 ? 0.94 : 1);
  const props: FormProps = {
    color: bodyColor,
    s: scale,
    sex,
    ageRatio,
    healthRatio,
    rarity,
    variantSeed,
  };
  switch (speciesId) {
    case "elephant":
      return <Elephant {...props} />;
    case "giraffe":
      return <Giraffe {...props} />;
    case "flamingo":
      return <Flamingo {...props} />;
    case "penguin":
      return <Penguin {...props} />;
    case "hippo":
      return <Hippo {...props} />;
    case "lion":
      return <Lion {...props} />;
    case "tiger":
    case "snow-leopard":
      return <BigCat {...props} striped={speciesId === "tiger"} />;
    case "zebra":
      return <Zebra {...props} />;
    case "camel":
      return <Camel {...props} />;
    case "capuchin":
    case "red-panda":
      return <SmallClimber {...props} bushy={speciesId === "red-panda"} />;
    case "giant-panda":
      return <Panda {...props} />;
    case "polar-bear":
      return <Bear {...props} />;
    case "gray-wolf":
      return <Wolf {...props} />;
    case "meerkat":
      return <Meerkat {...props} />;
    default:
      return <GenericQuad {...props} />;
  }
}

function GenericQuad({ color, s }: FormProps) {
  const dark = shade(color, 0.75);
  const legH = 0.45 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.35 * s, 0]} scale={[1.1 * s, 0.45 * s, 0.5 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.7 * s, legH + 0.55 * s, 0]} castShadow>
        <sphereGeometry args={[0.32 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.95 * s, legH + 0.45 * s, 0]} castShadow>
        <sphereGeometry args={[0.14 * s, 8, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.72 * s} z={0.12 * s} color={dark} size={0.1 * s} />
      <QuadLegs y={legH / 2} spreadX={0.35 * s} spreadZ={0.22 * s} h={legH} r={0.1 * s} color={dark} />
      <mesh position={[-0.7 * s, legH + 0.4 * s, 0]} rotation={[0, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.08 * s, 0.55 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function Elephant({ color, s }: FormProps) {
  const dark = shade(color, 0.78);
  const legH = 0.7 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.55 * s, 0]} scale={[1.35 * s, 0.7 * s, 0.75 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.95 * s, legH + 0.7 * s, 0]} castShadow>
        <sphereGeometry args={[0.42 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      {/* ears */}
      <mesh position={[0.85 * s, legH + 0.85 * s, 0.45 * s]} rotation={[0.2, 0.4, 0.3]} castShadow>
        <sphereGeometry args={[0.35 * s, 8, 6]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[0.85 * s, legH + 0.85 * s, -0.45 * s]} rotation={[0.2, -0.4, -0.3]} castShadow>
        <sphereGeometry args={[0.35 * s, 8, 6]} />
        <Mat color={dark} />
      </mesh>
      {/* trunk */}
      <mesh position={[1.25 * s, legH + 0.35 * s, 0]} rotation={[0, 0, 0.55]} castShadow>
        <cylinderGeometry args={[0.1 * s, 0.16 * s, 0.9 * s, 7]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[1.55 * s, legH + 0.05 * s, 0]} castShadow>
        <sphereGeometry args={[0.11 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      {/* tusks */}
      <mesh position={[1.2 * s, legH + 0.45 * s, 0.18 * s]} rotation={[0.2, 0, -0.9]} castShadow>
        <coneGeometry args={[0.05 * s, 0.45 * s, 5]} />
        <Mat color="#f0e6d0" rough={0.55} />
      </mesh>
      <mesh position={[1.2 * s, legH + 0.45 * s, -0.18 * s]} rotation={[-0.2, 0, -0.9]} castShadow>
        <coneGeometry args={[0.05 * s, 0.45 * s, 5]} />
        <Mat color="#f0e6d0" rough={0.55} />
      </mesh>
      <QuadLegs y={legH / 2} spreadX={0.45 * s} spreadZ={0.32 * s} h={legH} r={0.18 * s} color={dark} />
      <mesh position={[-0.95 * s, legH + 0.55 * s, 0]} rotation={[0.4, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.06 * s, 0.12 * s, 0.55 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function Giraffe({ color, s }: FormProps) {
  const dark = shade(color, 0.72);
  const spot = shade(color, 0.55);
  const legH = 1.05 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.35 * s, 0]} scale={[0.95 * s, 0.4 * s, 0.4 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      {/* neck */}
      <mesh position={[0.35 * s, legH + 1.15 * s, 0]} rotation={[0, 0, -0.25]} castShadow>
        <cylinderGeometry args={[0.12 * s, 0.18 * s, 1.5 * s, 7]} />
        <Mat color={color} />
      </mesh>
      {/* spots on neck */}
      <mesh position={[0.42 * s, legH + 1.4 * s, 0.12 * s]} castShadow>
        <sphereGeometry args={[0.08 * s, 6, 5]} />
        <Mat color={spot} />
      </mesh>
      <mesh position={[0.28 * s, legH + 0.95 * s, -0.12 * s]} castShadow>
        <sphereGeometry args={[0.07 * s, 6, 5]} />
        <Mat color={spot} />
      </mesh>
      <mesh position={[0.55 * s, legH + 1.85 * s, 0]} castShadow>
        <sphereGeometry args={[0.28 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.75 * s, legH + 1.75 * s, 0]} castShadow>
        <sphereGeometry args={[0.12 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      {/* ossicones */}
      <mesh position={[0.5 * s, legH + 2.15 * s, 0.1 * s]} castShadow>
        <cylinderGeometry args={[0.03 * s, 0.04 * s, 0.18 * s, 5]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[0.5 * s, legH + 2.15 * s, -0.1 * s]} castShadow>
        <cylinderGeometry args={[0.03 * s, 0.04 * s, 0.18 * s, 5]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 2.0 * s} z={0.16 * s} color={dark} size={0.09 * s} />
      <QuadLegs y={legH / 2} spreadX={0.28 * s} spreadZ={0.18 * s} h={legH} r={0.09 * s} color={dark} />
      <mesh position={[-0.55 * s, legH + 0.45 * s, 0]} rotation={[0.3, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.07 * s, 0.7 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function Flamingo({ color, s }: FormProps) {
  const dark = shade(color, 0.7);
  const beak = "#3a3030";
  const legH = 0.75 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.28 * s, 0]} scale={[0.35 * s, 0.28 * s, 0.28 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.08 * s, legH + 0.7 * s, 0]} rotation={[0, 0, -0.15]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.06 * s, 0.55 * s, 6]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.18 * s, legH + 1.0 * s, 0]} castShadow>
        <sphereGeometry args={[0.14 * s, 8, 7]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.32 * s, legH + 0.95 * s, 0]} rotation={[0, 0, 1.2]} castShadow>
        <coneGeometry args={[0.05 * s, 0.22 * s, 5]} />
        <Mat color={beak} rough={0.6} />
      </mesh>
      {/* wing */}
      <mesh position={[-0.05 * s, legH + 0.32 * s, 0.18 * s]} rotation={[0.3, 0.4, 0.2]} castShadow>
        <sphereGeometry args={[0.18 * s, 7, 5]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[-0.05 * s, legH + 0.32 * s, -0.18 * s]} rotation={[0.3, -0.4, -0.2]} castShadow>
        <sphereGeometry args={[0.18 * s, 7, 5]} />
        <Mat color={dark} />
      </mesh>
      {/* long legs */}
      <mesh position={[0.06 * s, legH / 2, 0.06 * s]} castShadow>
        <cylinderGeometry args={[0.03 * s, 0.04 * s, legH, 5]} />
        <Mat color="#c9a05a" />
      </mesh>
      <mesh position={[-0.04 * s, legH / 2, -0.06 * s]} castShadow>
        <cylinderGeometry args={[0.03 * s, 0.04 * s, legH, 5]} />
        <Mat color="#c9a05a" />
      </mesh>
    </group>
  );
}

function Penguin({ color, s }: FormProps) {
  const belly = "#f2f0ea";
  const beak = "#e0a040";
  return (
    <group>
      <mesh position={[0, 0.55 * s, 0]} scale={[0.38 * s, 0.55 * s, 0.35 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.06 * s, 0.52 * s, 0]} scale={[0.28 * s, 0.45 * s, 0.22 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={belly} />
      </mesh>
      <mesh position={[0, 1.05 * s, 0]} castShadow>
        <sphereGeometry args={[0.22 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.2 * s, 1.0 * s, 0]} rotation={[0, 0, 1.1]} castShadow>
        <coneGeometry args={[0.05 * s, 0.16 * s, 5]} />
        <Mat color={beak} rough={0.55} />
      </mesh>
      {/* flippers */}
      <mesh position={[0, 0.55 * s, 0.28 * s]} rotation={[0.2, 0, 0.4]} castShadow>
        <sphereGeometry args={[0.14 * s, 7, 5]} />
        <Mat color={shade(color, 0.7)} />
      </mesh>
      <mesh position={[0, 0.55 * s, -0.28 * s]} rotation={[0.2, 0, -0.4]} castShadow>
        <sphereGeometry args={[0.14 * s, 7, 5]} />
        <Mat color={shade(color, 0.7)} />
      </mesh>
      <mesh position={[0.08 * s, 0.08 * s, 0.08 * s]} castShadow>
        <sphereGeometry args={[0.08 * s, 6, 5]} />
        <Mat color={beak} />
      </mesh>
      <mesh position={[0.08 * s, 0.08 * s, -0.08 * s]} castShadow>
        <sphereGeometry args={[0.08 * s, 6, 5]} />
        <Mat color={beak} />
      </mesh>
    </group>
  );
}

function Hippo({ color, s }: FormProps) {
  const dark = shade(color, 0.78);
  const legH = 0.35 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.4 * s, 0]} scale={[1.2 * s, 0.55 * s, 0.7 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.85 * s, legH + 0.4 * s, 0]} scale={[0.5 * s, 0.4 * s, 0.5 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[1.2 * s, legH + 0.28 * s, 0]} castShadow>
        <boxGeometry args={[0.35 * s, 0.2 * s, 0.4 * s]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.7 * s} z={0.2 * s} color={dark} size={0.1 * s} />
      <QuadLegs y={legH / 2} spreadX={0.4 * s} spreadZ={0.28 * s} h={legH} r={0.14 * s} color={dark} />
      <mesh position={[-0.85 * s, legH + 0.35 * s, 0]} rotation={[0.5, 0, 0.3]} castShadow>
        <cylinderGeometry args={[0.05 * s, 0.1 * s, 0.4 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function Lion({ color, s, sex = "male" }: FormProps) {
  const dark = shade(color, 0.72);
  const mane = shade(color, 0.55);
  const legH = 0.5 * s;
  const showMane = sex !== "female";
  return (
    <group>
      <mesh position={[0, legH + 0.38 * s, 0]} scale={[1.15 * s, 0.45 * s, 0.5 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.75 * s, legH + 0.55 * s, 0]} castShadow>
        <sphereGeometry args={[0.32 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      {showMane && (
        <mesh position={[0.65 * s, legH + 0.55 * s, 0]} castShadow>
          <sphereGeometry args={[0.42 * s, 8, 6]} />
          <Mat color={mane} />
        </mesh>
      )}
      <mesh position={[1.0 * s, legH + 0.45 * s, 0]} castShadow>
        <sphereGeometry args={[0.12 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.8 * s} z={0.12 * s} color={showMane ? mane : dark} size={0.1 * s} />
      <QuadLegs y={legH / 2} spreadX={0.35 * s} spreadZ={0.22 * s} h={legH} r={0.1 * s} color={dark} />
      <mesh position={[-0.75 * s, legH + 0.4 * s, 0]} rotation={[0.2, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.05 * s, 0.09 * s, 0.65 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function BigCat({ color, s, striped }: FormProps & { striped?: boolean }) {
  const dark = shade(color, 0.7);
  const stripe = shade(color, 0.45);
  const legH = 0.48 * s;
  const stripes = useMemo(
    () =>
      striped
        ? [
            [0.2, 0.15],
            [-0.1, -0.12],
            [0.35, -0.1],
            [-0.35, 0.1],
          ]
        : [],
    [striped],
  );
  return (
    <group>
      <mesh position={[0, legH + 0.35 * s, 0]} scale={[1.2 * s, 0.4 * s, 0.45 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      {stripes.map(([x, z], i) => (
        <mesh key={i} position={[x * s, legH + 0.5 * s, z * s]} castShadow>
          <boxGeometry args={[0.08 * s, 0.22 * s, 0.35 * s]} />
          <Mat color={stripe} />
        </mesh>
      ))}
      <mesh position={[0.8 * s, legH + 0.48 * s, 0]} castShadow>
        <sphereGeometry args={[0.3 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[1.05 * s, legH + 0.4 * s, 0]} castShadow>
        <sphereGeometry args={[0.12 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.72 * s} z={0.12 * s} color={dark} size={0.1 * s} />
      <QuadLegs y={legH / 2} spreadX={0.38 * s} spreadZ={0.22 * s} h={legH} r={0.1 * s} color={dark} />
      <mesh position={[-0.8 * s, legH + 0.35 * s, 0]} rotation={[0.15, 0, 0.35]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.08 * s, 0.7 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function Zebra({ color, s }: FormProps) {
  const dark = "#2a2a2a";
  const legH = 0.55 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.38 * s, 0]} scale={[1.15 * s, 0.42 * s, 0.4 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      {[0.35, 0.05, -0.25].map((x, i) => (
        <mesh key={i} position={[x * s, legH + 0.5 * s, 0]} castShadow>
          <boxGeometry args={[0.1 * s, 0.35 * s, 0.42 * s]} />
          <Mat color={dark} />
        </mesh>
      ))}
      <mesh position={[0.75 * s, legH + 0.55 * s, 0]} castShadow>
        <sphereGeometry args={[0.26 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.95 * s, legH + 0.48 * s, 0]} castShadow>
        <sphereGeometry args={[0.12 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.78 * s} z={0.1 * s} color={dark} size={0.1 * s} />
      <QuadLegs y={legH / 2} spreadX={0.35 * s} spreadZ={0.18 * s} h={legH} r={0.08 * s} color={dark} />
      <mesh position={[-0.7 * s, legH + 0.45 * s, 0]} rotation={[0.2, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.07 * s, 0.55 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function Camel({ color, s }: FormProps) {
  const dark = shade(color, 0.75);
  const legH = 0.7 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.4 * s, 0]} scale={[1.2 * s, 0.45 * s, 0.45 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      {/* humps */}
      <mesh position={[0.2 * s, legH + 0.75 * s, 0]} castShadow>
        <sphereGeometry args={[0.28 * s, 8, 6]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[-0.25 * s, legH + 0.7 * s, 0]} castShadow>
        <sphereGeometry args={[0.24 * s, 8, 6]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.55 * s, legH + 0.85 * s, 0]} rotation={[0, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.1 * s, 0.14 * s, 0.55 * s, 6]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.8 * s, legH + 1.1 * s, 0]} castShadow>
        <sphereGeometry args={[0.24 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[1.0 * s, legH + 1.0 * s, 0]} castShadow>
        <sphereGeometry args={[0.1 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 1.28 * s} z={0.1 * s} color={dark} size={0.09 * s} />
      <QuadLegs y={legH / 2} spreadX={0.35 * s} spreadZ={0.2 * s} h={legH} r={0.1 * s} color={dark} />
    </group>
  );
}

function SmallClimber({ color, s, bushy }: FormProps & { bushy?: boolean }) {
  const dark = shade(color, 0.7);
  const legH = 0.28 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.28 * s, 0]} scale={[0.7 * s, 0.35 * s, 0.4 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.4 * s, legH + 0.4 * s, 0]} castShadow>
        <sphereGeometry args={[0.24 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.55 * s, legH + 0.35 * s, 0]} castShadow>
        <sphereGeometry args={[0.1 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.58 * s} z={0.12 * s} color={bushy ? color : dark} size={0.1 * s} />
      <QuadLegs y={legH / 2} spreadX={0.22 * s} spreadZ={0.14 * s} h={legH} r={0.06 * s} color={dark} />
      <mesh
        position={[-0.45 * s, legH + 0.3 * s, 0]}
        rotation={[0.2, 0, 0.5]}
        scale={bushy ? [1.2, 1, 1.3] : [1, 1, 1]}
        castShadow
      >
        <sphereGeometry args={[0.16 * s, 7, 6]} />
        <Mat color={bushy ? color : dark} />
      </mesh>
    </group>
  );
}

function Panda({ color, s }: FormProps) {
  const black = "#2a2a2a";
  const legH = 0.4 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.4 * s, 0]} scale={[0.9 * s, 0.55 * s, 0.6 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.55 * s, legH + 0.65 * s, 0]} castShadow>
        <sphereGeometry args={[0.35 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      {/* eye patches + ears */}
      <mesh position={[0.7 * s, legH + 0.7 * s, 0.18 * s]} castShadow>
        <sphereGeometry args={[0.1 * s, 7, 6]} />
        <Mat color={black} />
      </mesh>
      <mesh position={[0.7 * s, legH + 0.7 * s, -0.18 * s]} castShadow>
        <sphereGeometry args={[0.1 * s, 7, 6]} />
        <Mat color={black} />
      </mesh>
      <Ears y={legH + 0.95 * s} z={0.2 * s} color={black} size={0.12 * s} />
      <mesh position={[0.85 * s, legH + 0.55 * s, 0]} castShadow>
        <sphereGeometry args={[0.1 * s, 7, 6]} />
        <Mat color={black} />
      </mesh>
      <QuadLegs y={legH / 2} spreadX={0.3 * s} spreadZ={0.22 * s} h={legH} r={0.12 * s} color={black} />
    </group>
  );
}

function Bear({ color, s }: FormProps) {
  const dark = shade(color, 0.8);
  const legH = 0.45 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.45 * s, 0]} scale={[1.05 * s, 0.55 * s, 0.6 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.7 * s, legH + 0.55 * s, 0]} castShadow>
        <sphereGeometry args={[0.36 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.95 * s, legH + 0.45 * s, 0]} castShadow>
        <sphereGeometry args={[0.14 * s, 7, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.85 * s} z={0.16 * s} color={dark} size={0.12 * s} />
      <QuadLegs y={legH / 2} spreadX={0.35 * s} spreadZ={0.25 * s} h={legH} r={0.14 * s} color={dark} />
    </group>
  );
}

function Wolf({ color, s }: FormProps) {
  const dark = shade(color, 0.7);
  const legH = 0.48 * s;
  return (
    <group>
      <mesh position={[0, legH + 0.35 * s, 0]} scale={[1.15 * s, 0.4 * s, 0.4 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.75 * s, legH + 0.48 * s, 0]} castShadow>
        <sphereGeometry args={[0.26 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.98 * s, legH + 0.4 * s, 0]} castShadow>
        <coneGeometry args={[0.1 * s, 0.28 * s, 6]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 0.72 * s} z={0.1 * s} color={dark} size={0.11 * s} />
      <QuadLegs y={legH / 2} spreadX={0.35 * s} spreadZ={0.18 * s} h={legH} r={0.08 * s} color={dark} />
      <mesh position={[-0.75 * s, legH + 0.35 * s, 0]} rotation={[0.1, 0, 0.35]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.08 * s, 0.6 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}

function Meerkat({ color, s }: FormProps) {
  const dark = shade(color, 0.7);
  const legH = 0.35 * s;
  return (
    <group>
      {/* upright posture */}
      <mesh position={[0, legH + 0.4 * s, 0]} scale={[0.28 * s, 0.5 * s, 0.28 * s]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, legH + 0.85 * s, 0]} castShadow>
        <sphereGeometry args={[0.2 * s, 10, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.14 * s, legH + 0.8 * s, 0]} castShadow>
        <sphereGeometry args={[0.07 * s, 6, 5]} />
        <Mat color={dark} />
      </mesh>
      <Ears y={legH + 1.02 * s} z={0.08 * s} color={dark} size={0.07 * s} />
      <mesh position={[0.08 * s, legH / 2, 0.06 * s]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.05 * s, legH, 5]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[-0.06 * s, legH / 2, -0.05 * s]} castShadow>
        <cylinderGeometry args={[0.04 * s, 0.05 * s, legH, 5]} />
        <Mat color={dark} />
      </mesh>
      {/* arms */}
      <mesh position={[0.12 * s, legH + 0.45 * s, 0.12 * s]} rotation={[0.4, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.03 * s, 0.04 * s, 0.28 * s, 5]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[0.12 * s, legH + 0.45 * s, -0.12 * s]} rotation={[-0.4, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.03 * s, 0.04 * s, 0.28 * s, 5]} />
        <Mat color={dark} />
      </mesh>
      <mesh position={[0, legH + 0.15 * s, -0.15 * s]} rotation={[0.6, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03 * s, 0.05 * s, 0.35 * s, 5]} />
        <Mat color={dark} />
      </mesh>
    </group>
  );
}
