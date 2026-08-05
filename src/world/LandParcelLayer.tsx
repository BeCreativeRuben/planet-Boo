/**
 * Wildhaven — land survey overlays.
 *
 * While surveying, every parcel on the fixed map is drawn as a flat tint so
 * owned / buyable / locked land reads clearly from the forced top-down camera.
 * Buyable amber plots are clickable and labelled with compass + cost.
 */

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

import {
  PARCEL_SIZE,
  PARCELS_AXIS,
  listBuyableParcels,
  parcelKey,
  parcelWorldBounds,
  parcelWorldCenter,
} from "../game/parcels";
import { HALF } from "../game/simulation";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function ParcelPad({
  px,
  pz,
  kind,
  label,
  cost,
  disabled,
  onBuy,
}: {
  px: number;
  pz: number;
  kind: "owned" | "buy" | "locked";
  label?: string;
  cost?: number;
  disabled?: boolean;
  onBuy?: () => void;
}) {
  const center = parcelWorldCenter(px, pz);
  const bounds = parcelWorldBounds(px, pz);
  const w = bounds.max.x - bounds.min.x - 0.6;
  const d = bounds.max.z - bounds.min.z - 0.6;
  const color =
    kind === "owned" ? "#5a8f3a" : kind === "buy" ? "#e7b84a" : "#2a3228";
  const opacity = kind === "owned" ? 0.28 : kind === "buy" ? 0.55 : 0.18;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (kind !== "buy" || disabled || !onBuy) return;
    e.stopPropagation();
    onBuy();
  };

  return (
    <group position={[center.x, 0.12, center.z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onClick}
        onPointerOver={
          kind === "buy" && !disabled
            ? (e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }
            : undefined
        }
        onPointerOut={
          kind === "buy"
            ? () => {
                document.body.style.cursor = "auto";
              }
            : undefined
        }
      >
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      {kind === "buy" && label && (
        <Html center distanceFactor={48} style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
          <div className={`land-pad-label${disabled ? " land-pad-label--disabled" : ""}`}>
            <strong>{label}</strong>
            {cost != null && <span>{money(cost)}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

function CompassMarker({
  label,
  x,
  z,
  hint,
}: {
  label: string;
  x: number;
  z: number;
  hint: string;
}) {
  return (
    <group position={[x, 0.4, z]}>
      <Html center distanceFactor={55} style={{ pointerEvents: "none" }} zIndexRange={[50, 0]}>
        <div className="land-compass">
          <span className="land-compass__dir">{label}</span>
          <span className="land-compass__hint">{hint}</span>
        </div>
      </Html>
    </group>
  );
}

/** Full-map parcel tint + buy handles — only mounted while surveying. */
export function LandParcelLayer() {
  const open = useUIStore((s) => s.landSelectOpen);
  const ownedParcels = useGameStore((s) => s.ownedParcels);
  const cash = useGameStore((s) => s.finances.cash);
  const buyParcel = useGameStore((s) => s.buyParcel);
  const ownedKey = ownedParcels.join("|");

  const { ownedSet, buyableMap } = useMemo(() => {
    const ownedSet = new Set(ownedParcels);
    const buyable = listBuyableParcels(ownedParcels);
    return {
      ownedSet,
      buyableMap: new Map(buyable.map((b) => [b.key, b])),
    };
  }, [ownedKey, ownedParcels]);

  if (!open) return null;

  const edge = HALF - PARCEL_SIZE * 0.35;

  return (
    <group>
      {/* Soft scrim so wilderness parcels read as “outside” */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[MAX_PLANE, MAX_PLANE]} />
        <meshBasicMaterial color="#0e120e" transparent opacity={0.35} depthWrite={false} />
      </mesh>

      {Array.from({ length: PARCELS_AXIS }, (_, pz) =>
        Array.from({ length: PARCELS_AXIS }, (_, px) => {
          const key = parcelKey(px, pz);
          const offer = buyableMap.get(key);
          if (ownedSet.has(key)) {
            return <ParcelPad key={key} px={px} pz={pz} kind="owned" />;
          }
          if (offer) {
            const cantAfford = cash < offer.cost;
            return (
              <ParcelPad
                key={key}
                px={px}
                pz={pz}
                kind="buy"
                label={offer.direction}
                cost={offer.cost}
                disabled={cantAfford}
                onBuy={() => buyParcel(offer.key)}
              />
            );
          }
          return <ParcelPad key={key} px={px} pz={pz} kind="locked" />;
        }),
      )}

      <CompassMarker label="N" x={0} z={-edge} hint="Back of park" />
      <CompassMarker label="S" x={0} z={edge} hint="Entrance · parking" />
      <CompassMarker label="W" x={-edge} z={0} hint="West" />
      <CompassMarker label="E" x={edge} z={0} hint="East" />
    </group>
  );
}

const MAX_PLANE = PARCELS_AXIS * PARCEL_SIZE + 4;

export default LandParcelLayer;
