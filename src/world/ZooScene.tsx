/**
 * Wildhaven — main 3D scene.
 *
 * Warm daylight, sky backdrop, wilderness ring, owned-plot terrain, and the
 * interactive park layers. Simulation advances from the render loop.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";

import { Terrain } from "./Terrain";
import { Buildings } from "./Buildings";
import { Animals } from "./Animals";
import { Guests } from "./Guests";
import { BuildGhost } from "./BuildGhost";
import { BuildSnapPlane } from "./BuildSnapPlane";
import { HabitatHighlights } from "./HabitatHighlights";
import { CameraRig } from "./CameraRig";
import { ParkBackdrop, PlotBoundary } from "./ParkBackdrop";

function SimulationDriver() {
  const step = useGameStore((s) => s.step);
  useFrame((_, delta) => {
    step(Math.min(delta, 0.1));
  });
  return null;
}

function Daylight() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const plotSize = useGameStore((s) => s.plotSize);
  const t = timeOfDay;
  const dayness = Math.max(0.15, Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
  const sunIntensity = 0.55 + dayness * 1.2;
  const warmth = 1 - dayness;
  const sunColor = new THREE.Color().setHSL(0.11 - warmth * 0.03, 0.55, 0.62 + dayness * 0.08);
  const ambientColor = new THREE.Color().setHSL(0.25, 0.25, 0.55);
  const extent = Math.max(plotSize, 80) / 2 + 20;

  return (
    <>
      <hemisphereLight args={["#d7ebc8", "#6b5a3e", 0.75]} />
      <ambientLight color={ambientColor} intensity={0.32} />
      <directionalLight
        castShadow
        position={[48, 78, 36]}
        intensity={sunIntensity}
        color={sunColor}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={280}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-bias={-0.0004}
      />
    </>
  );
}

function Atmosphere() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const dayness = Math.max(0.15, Math.sin(Math.PI * Math.min(1, Math.max(0, timeOfDay))));
  const fog = new THREE.Color().setHSL(0.18, 0.25, 0.55 + dayness * 0.12);
  return <fog attach="fog" args={[fog.getStyle(), 70, 240]} />;
}

export function ZooScene() {
  const plotSize = useGameStore((s) => s.plotSize);
  const maxDist = Math.min(160, 70 + plotSize * 0.5);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 46, 62], fov: 48, near: 0.5, far: 500 }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <Atmosphere />
      <ParkBackdrop />
      <Daylight />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={maxDist}
        maxPolarAngle={(75 * Math.PI) / 180}
        minPolarAngle={0.12}
        target={[0, 0, 0]}
      />
      <CameraRig />

      <Terrain />
      <PlotBoundary />
      <HabitatHighlights />
      <Buildings />
      <Animals />
      <Guests />
      <BuildSnapPlane />
      <BuildGhost />

      <SimulationDriver />
    </Canvas>
  );
}

export default ZooScene;
