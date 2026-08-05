/**
 * Wildhaven — camera rig.
 *
 * When the player focuses an animal (by clicking it), the orbit controls' target
 * glides smoothly to that animal and gently tracks it for a moment. Panning or
 * selecting empty ground clears the focus so the camera hands control back.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useGameStore } from "../store/gameStore";

/** The slice of OrbitControls this rig actually touches. */
interface OrbitLike {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export function CameraRig() {
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const focusAnimalId = useGameStore((s) => s.focusAnimalId);
  const desired = useRef(new THREE.Vector3());

  // Clear focus whenever the user drags the camera themselves.
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      if (useGameStore.getState().focusAnimalId) {
        useGameStore.getState().focusAnimal(null);
      }
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useFrame(() => {
    if (!controls || !focusAnimalId) return;
    const animal = useGameStore.getState().animals[focusAnimalId];
    if (!animal) return;
    desired.current.set(animal.position.x, 0, animal.position.z);
    controls.target.lerp(desired.current, 0.06);
    controls.update();
  });

  return null;
}

export default CameraRig;
