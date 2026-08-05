/**
 * Wildhaven — main 3D scene.
 *
 * Wraps the whole park in an R3F <Canvas>: warm daylight, soft shadows, a
 * gentle golden-green atmosphere, constrained orbit controls, and all the
 * world layers (terrain, buildings, animals, guests, build ghost, habitat
 * highlights). A tiny driver component pumps the simulation from the render
 * loop.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";
import { MAP_SIZE } from "../game/simulation";

import { Terrain } from "./Terrain";
import { Buildings } from "./Buildings";
import { Animals } from "./Animals";
import { Guests } from "./Guests";
import { BuildGhost } from "./BuildGhost";
import { HabitatHighlights } from "./HabitatHighlights";
import { CameraRig } from "./CameraRig";

/* -------------------------------------------------------------------------- */
/*  Simulation driver — advances the store each frame.                        */
/* -------------------------------------------------------------------------- */

function SimulationDriver() {
  const step = useGameStore((s) => s.step);
  useFrame((_, delta) => {
    // Clamp delta so a stalled tab (huge delta) can't teleport everything.
    step(Math.min(delta, 0.1));
  });
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Daylight — subtle day/night tint driven by timeOfDay.                     */
/* -------------------------------------------------------------------------- */

function Daylight() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);

  // Map 0..1 to a warm daylight curve. Peak brightness near noon (0.5),
  // dimmer and warmer toward dawn/dusk. Never fully dark — this is a zoo.
  const t = timeOfDay;
  const dayness = Math.max(0.15, Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
  const sunIntensity = 0.5 + dayness * 1.15;
  const warmth = 1 - dayness; // 0 = white noon, 1 = golden dawn/dusk
  const sunColor = new THREE.Color().setHSL(
    0.11 - warmth * 0.03,
    0.55,
    0.62 + dayness * 0.08,
  );
  const ambientColor = new THREE.Color().setHSL(0.25, 0.25, 0.55);

  return (
    <>
      <hemisphereLight args={["#cfe3b8", "#6b5a3e", 0.7]} />
      <ambientLight color={ambientColor} intensity={0.35} />
      <directionalLight
        castShadow
        position={[40, 70, 30]}
        intensity={sunIntensity}
        color={sunColor}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-MAP_SIZE / 2 - 6}
        shadow-camera-right={MAP_SIZE / 2 + 6}
        shadow-camera-top={MAP_SIZE / 2 + 6}
        shadow-camera-bottom={-MAP_SIZE / 2 - 6}
        shadow-bias={-0.0004}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scene                                                                     */
/* -------------------------------------------------------------------------- */

export function ZooScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 46, 62], fov: 48, near: 0.5, far: 400 }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <color attach="background" args={["#bfe0d0"]} />
      <fog attach="fog" args={["#cfe3c4", 90, 260]} />

      <Daylight />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={120}
        maxPolarAngle={(75 * Math.PI) / 180}
        minPolarAngle={0.12}
        target={[0, 0, 0]}
      />
      <CameraRig />

      <Terrain />
      <HabitatHighlights />
      <Buildings />
      <Animals />
      <Guests />
      <BuildGhost />

      <SimulationDriver />
    </Canvas>
  );
}

export default ZooScene;
