/**
 * Wildhaven — sky, hills and wilderness backdrop.
 *
 * Soft golden-hour sky dome, distant ridgelines, and a wild outer ring beyond
 * the owned plot so the park feels nestled in a living landscape.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

import { useGameStore } from "../store/gameStore";
import { MAX_MAP_SIZE } from "../game/simulation";

export function ParkBackdrop() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const plotSize = useGameStore((s) => s.plotSize);

  return (
    <group>
      <SkyDome timeOfDay={timeOfDay} />
      <DistantHills />
      <WildernessRing plotSize={plotSize} />
      <HorizonHaze />
      <CloudBand timeOfDay={timeOfDay} />
    </group>
  );
}

function SkyDome({ timeOfDay }: { timeOfDay: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const dayness = Math.max(0.12, Math.sin(Math.PI * Math.min(1, Math.max(0, timeOfDay))));

  useFrame(() => {
    if (mat.current) mat.current.uniforms.uDayness.value = dayness;
  });

  const uniforms = useMemo(
    () => ({
      uDayness: { value: dayness },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <mesh>
      <sphereGeometry args={[380, 48, 24]} />
      <shaderMaterial
        ref={mat}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorld;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          uniform float uDayness;
          varying vec3 vWorld;
          void main() {
            float h = normalize(vWorld).y;
            vec3 zenith = mix(vec3(0.18, 0.28, 0.42), vec3(0.45, 0.72, 0.92), uDayness);
            vec3 mid = mix(vec3(0.55, 0.32, 0.28), vec3(0.72, 0.86, 0.78), uDayness);
            vec3 horizon = mix(vec3(0.85, 0.48, 0.28), vec3(0.95, 0.82, 0.55), uDayness);
            vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.25, h));
            col = mix(col, zenith, smoothstep(0.2, 0.85, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function DistantHills() {
  const hills = useMemo(() => {
    const out: { x: number; z: number; s: number; h: number; color: string }[] = [];
    const colors = ["#4a6b3e", "#5a7a48", "#3f5e38", "#6a8050", "#556b42"];
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2 + (i % 3) * 0.08;
      const dist = 95 + (i % 5) * 14;
      out.push({
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        s: 18 + (i % 7) * 4,
        h: 8 + (i % 5) * 3.5,
        color: colors[i % colors.length],
      });
    }
    return out;
  }, []);

  return (
    <group>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, h.h * 0.35, h.z]} castShadow={false} receiveShadow={false}>
          <coneGeometry args={[h.s, h.h, 5]} />
          <meshStandardMaterial color={h.color} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function WildernessRing({ plotSize }: { plotSize: number }) {
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(plotSize / 2 + 0.5, MAX_MAP_SIZE / 2 + 8, 96);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [plotSize]);

  return (
    <mesh geometry={geo} position={[0, -0.02, 0]} receiveShadow>
      <meshStandardMaterial color="#5c7348" roughness={1} />
    </mesh>
  );
}

function HorizonHaze() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
      <ringGeometry args={[70, 210, 64]} />
      <meshBasicMaterial color="#d9c89a" transparent opacity={0.18} depthWrite={false} />
    </mesh>
  );
}

function CloudBand({ timeOfDay }: { timeOfDay: number }) {
  const group = useRef<THREE.Group>(null);
  const dayness = Math.max(0.15, Math.sin(Math.PI * Math.min(1, Math.max(0, timeOfDay))));

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.012;
  });

  const clouds = useMemo(() => {
    const list: { x: number; y: number; z: number; s: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const r = 55 + (i % 4) * 18;
      list.push({
        x: Math.cos(ang) * r,
        y: 28 + (i % 5) * 3,
        z: Math.sin(ang) * r,
        s: 6 + (i % 4) * 2.5,
      });
    }
    return list;
  }, []);

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]}>
          <sphereGeometry args={[c.s, 8, 6]} />
          <meshStandardMaterial
            color="#f4f0e4"
            transparent
            opacity={0.22 + dayness * 0.28}
            roughness={1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Soft boundary posts marking the owned plot edge. */
export function PlotBoundary() {
  const plotSize = useGameStore((s) => s.plotSize);
  const half = plotSize / 2;
  const min = -half;
  const max = half;

  const posts = useMemo(() => {
    const pts: [number, number][] = [];
    const step = Math.max(4, Math.floor(plotSize / 12));
    for (let x = min; x <= max; x += step) {
      pts.push([x, min]);
      pts.push([x, max]);
    }
    for (let z = min + step; z < max; z += step) {
      pts.push([min, z]);
      pts.push([max, z]);
    }
    return pts;
  }, [min, max, plotSize]);

  return (
    <group>
      <mesh position={[0, 0.07, min]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[plotSize, 0.35]} />
        <meshBasicMaterial color="#c9a227" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.07, max]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[plotSize, 0.35]} />
        <meshBasicMaterial color="#c9a227" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[min, 0.07, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[plotSize, 0.35]} />
        <meshBasicMaterial color="#c9a227" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[max, 0.07, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[plotSize, 0.35]} />
        <meshBasicMaterial color="#c9a227" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.55, z]}>
          <cylinderGeometry args={[0.08, 0.1, 1.1, 5]} />
          <meshStandardMaterial color="#6b5230" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default ParkBackdrop;
