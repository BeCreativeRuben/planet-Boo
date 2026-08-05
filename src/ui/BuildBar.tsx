/**
 * Wildhaven — contextual build strip.
 *
 * Sits just above the bottom toolbar and shows the palette for whichever tab is
 * open. Picking a buildable arms the store's build mode (so the 3D scene shows a
 * ghost and a click places it); picking a species arms adoption; the staff tab
 * hires directly. Selecting the armed item again disarms it.
 */

import type { Biome } from "../game/types";
import type { BuildTab } from "../store/uiStore";

import { buildingsByCategory } from "../game/buildings";
import { getSpecies } from "../game/species";
import { STAFF_ROLES } from "../game/staffTypes";
import { useGameStore } from "../store/gameStore";

const money = (n: number) => (n <= 0 ? "Free" : `$${n.toLocaleString()}`);

const BIOMES: { id: Biome; label: string; icon: string }[] = [
  { id: "savanna", label: "Savanna", icon: "🌾" },
  { id: "forest", label: "Forest", icon: "🌲" },
  { id: "wetland", label: "Wetland", icon: "💧" },
  { id: "desert", label: "Desert", icon: "🏜️" },
  { id: "arctic", label: "Arctic", icon: "❄️" },
  { id: "mountain", label: "Mountain", icon: "⛰️" },
];

/** Which building categories each tab surfaces (in order). */
const TAB_CATEGORIES: Record<BuildTab, Array<"habitat" | "scenery" | "enrichment" | "guest" | "staff">> = {
  habitat: ["habitat"],
  scenery: ["scenery", "enrichment"],
  guest: ["guest"],
  staff: ["staff"],
  animals: [],
};

const TAB_TITLE: Record<BuildTab, string> = {
  habitat: "Fencing & gates",
  scenery: "Scenery & enrichment",
  guest: "Guest amenities",
  staff: "Staff facilities & hiring",
  animals: "Adopt an animal",
};

export default function BuildBar({ tab }: { tab: BuildTab }) {
  const build = useGameStore((s) => s.build);
  const cash = useGameStore((s) => s.finances.cash);
  const buildBiome = useGameStore((s) => s.buildBiome);
  const unlockedSpecies = useGameStore((s) => s.unlockedSpecies);

  const setBuildMode = useGameStore((s) => s.setBuildMode);
  const setBuildBiome = useGameStore((s) => s.setBuildBiome);
  const hireStaff = useGameStore((s) => s.hireStaff);

  const selectBuilding = (defId: string) => {
    const armed = build.tool === "place" && build.selectedDefId === defId;
    setBuildMode(
      armed
        ? { active: false, tool: "none", selectedDefId: undefined, selectedSpeciesId: undefined }
        : { active: true, tool: "place", selectedDefId: defId, selectedSpeciesId: undefined },
    );
  };

  const selectSpecies = (speciesId: string) => {
    const armed = build.tool === "animal" && build.selectedSpeciesId === speciesId;
    setBuildMode(
      armed
        ? { active: false, tool: "none", selectedDefId: undefined, selectedSpeciesId: undefined }
        : { active: true, tool: "animal", selectedSpeciesId: speciesId, selectedDefId: undefined },
    );
  };

  const buildings = TAB_CATEGORIES[tab]
    .flatMap((c) => buildingsByCategory(c))
    .filter((d) => d.id !== "entrance-arch");

  return (
    <div className="buildbar glass">
      <div className="buildbar__title">{TAB_TITLE[tab]}</div>

      <div className="buildbar__strip">
        {tab === "habitat" &&
          BIOMES.map((b) => (
            <button
              key={b.id}
              type="button"
              className={buildBiome === b.id ? "biome biome--on" : "biome"}
              onClick={() => setBuildBiome(b.id)}
              title={`New enclosures default to ${b.label}`}
            >
              <span className="biome__icon" aria-hidden>
                {b.icon}
              </span>
              <span className="biome__label">{b.label}</span>
            </button>
          ))}

        {tab === "animals"
          ? unlockedSpecies.map((id) => {
              const s = getSpecies(id);
              if (!s) return null;
              const armed = build.tool === "animal" && build.selectedSpeciesId === id;
              const poor = cash < s.cost;
              return (
                <button
                  key={id}
                  type="button"
                  className={`item${armed ? " item--on" : ""}${poor ? " item--poor" : ""}`}
                  onClick={() => selectSpecies(id)}
                  title={s.description}
                >
                  <span className="item__icon" aria-hidden>
                    {s.icon}
                  </span>
                  <span className="item__name">{s.name}</span>
                  <span className="item__cost">{money(s.cost)}</span>
                </button>
              );
            })
          : buildings.map((d) => {
              const armed = build.tool === "place" && build.selectedDefId === d.id;
              const poor = cash < d.cost;
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`item${armed ? " item--on" : ""}${poor ? " item--poor" : ""}`}
                  onClick={() => selectBuilding(d.id)}
                  title={d.description}
                >
                  <span className="item__icon" aria-hidden>
                    {d.icon ?? "🧩"}
                  </span>
                  <span className="item__name">{d.name}</span>
                  <span className="item__cost">{money(d.cost)}</span>
                </button>
              );
            })}

        {tab === "staff" &&
          STAFF_ROLES.map((r) => {
            const poor = cash < r.hireCost;
            return (
              <button
                key={r.role}
                type="button"
                className={`item item--hire${poor ? " item--poor" : ""}`}
                onClick={() => hireStaff(r.role)}
                disabled={poor}
                title={`${r.description} · $${r.wage}/day wage`}
              >
                <span className="item__icon" aria-hidden>
                  {r.icon}
                </span>
                <span className="item__name">Hire {r.name}</span>
                <span className="item__cost">{money(r.hireCost)}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
