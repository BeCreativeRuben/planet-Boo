import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

import { ownedExtent } from "../game/parcels";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";

const SURVEY_HEIGHT = 188;
const NORMAL_POLAR_MAX = (75 * Math.PI) / 180;
const NORMAL_POLAR_MIN = 0.12;

interface OrbitLike {
  target: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  enableRotate: boolean;
  enablePan: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
  minDistance: number;
  maxDistance: number;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export function LandSurveyCamera() {
  const open = useUIStore((s) => s.landSelectOpen);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const camera = useThree((s) => s.camera);
  const saved = useRef<{
    pos: [number, number, number];
    target: [number, number, number];
  } | null>(null);

  useEffect(() => {
    if (!controls) return;

    if (open) {
      saved.current = {
        pos: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      };
      useGameStore.getState().focusAnimal(null);
      useGameStore.getState().selectEntity(null);

      controls.enableRotate = false;
      controls.enablePan = true;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0.02;
      controls.minDistance = 60;
      controls.maxDistance = 240;
      controls.target.set(0, 0, 0);
      camera.position.set(0, SURVEY_HEIGHT, 0.02);
      camera.near = 0.5;
      camera.far = 600;
      camera.updateProjectionMatrix();
      controls.update();
      return;
    }

    const extent = ownedExtent(useGameStore.getState().ownedParcels);
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.minPolarAngle = NORMAL_POLAR_MIN;
    controls.maxPolarAngle = NORMAL_POLAR_MAX;
    controls.minDistance = 8;
    controls.maxDistance = Math.min(160, 70 + extent.plotSize * 0.5);

    if (saved.current) {
      camera.position.set(...saved.current.pos);
      controls.target.set(...saved.current.target);
      saved.current = null;
    } else {
      controls.target.set(extent.cx, 0, extent.cz);
      camera.position.set(extent.cx, 46, extent.cz + Math.min(62, extent.plotSize * 0.7));
    }
    camera.far = 500;
    camera.updateProjectionMatrix();
    controls.update();
  }, [open, controls, camera]);

  useEffect(() => {
    if (!controls || !open) return;
    const lock = () => {
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0.02;
      if (Math.abs(camera.position.x - controls.target.x) > 2) {
        camera.position.x = controls.target.x;
      }
      if (Math.abs(camera.position.z - controls.target.z) > 2) {
        camera.position.z = controls.target.z + 0.02;
      }
    };
    controls.addEventListener("change", lock);
    return () => controls.removeEventListener("change", lock);
  }, [open, controls, camera]);

  return null;
}

export default LandSurveyCamera;
