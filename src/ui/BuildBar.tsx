/**
 * Wildhaven — contextual build strip.
 *
 * Habitat tab: pick a biome, claim closed enclosures, place fences/gates.
 * Biome chips update the selected habitat immediately, and set the biome used
 * when a new enclosure is claimed.
 */

import type { Biome } from "../game/types";
import type { BuildTab } from "../store/uiStore";

import { buildingsByCategory } from "../game/buildings";
import { getSpecies } from "../game/species";
import { STAFF_ROLES } from "../game/staffTypes";
import { useGameStore } from "../store/gameStore";

const money = (n: number) => (n <= 0 ? "Free" : `$${n.toLocaleString()}`);

export const BIOMES: { id: Biome; label: string; icon: string }[] = [
  { id: "savanna", label: "Savanna", icon: "🌾" },
  { id: "forest", label: "Forest", icon: "🌲" },
  { id: "wetland", label: "Wetland", icon: "💧" },
  { id: "desert", label: "Desert", icon: "🏜️" },
  { id: "arctic", label: "Arctic", icon: "❄️" },
  { id: "mountain", label: "Mountain", icon: "⛰️" },
];

const TAB_CATEGORIES: Record<
  BuildTab,
  Array<"habitat" | "scenery" | "enrichment" | "guest" | "staff">
> = {
  habitat: ["habitat"],
  scenery: ["scenery", "enrichment"],
  guest: ["guest"],
  staff: ["staff"],
  animals: [],
};

const TAB_TITLE: Record<BuildTab, string> = {
  habitat: "Habitats & fencing",
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
  const selection = useGameStore((s) => s.selection);
  const selectedHabitat = useGameStore((s) =>
    s.selection?.kind === "habitat" ? s.habitats[s.selection.id] : null,
  );

  const setBuildMode = useGameStore((s) => s.setBuildMode);
  const setBuildBiome = useGameStore((s) => s.setBuildBiome);
  const setHabitatBiome = useGameStore((s) => s.setHabitatBiome);
  const hireStaff = useGameStore((s) => s.hireStaff);

  const activeBiome = selectedHabitat?.biome ?? buildBiome;

  const pickBiome = (biome: Biome) => {
    setBuildBiome(biome);
    if (selection?.kind === "habitat") {
      setHabitatBiome(selection.id, biome);
    }
  };

  const selectBuilding = (defId: string) => {
    const armed =
      build.tool === "place" || build.tool === "fence" || build.tool === "gate"
        ? build.selectedDefId === defId
        : false;
    if (armed) {
      setBuildMode({
        active: false,
        tool: "none",
        selectedDefId: undefined,
        selectedSpeciesId: undefined,
      });
      return;
    }
    const tool =
      defId === "fence-segment" ? "fence" : defId === "habitat-gate" ? "gate" : "place";
    setBuildMode({
      active: true,
      tool,
      selectedDefId: defId,
      selectedSpeciesId: undefined,
    });
  };

  const selectSpecies = (speciesId: string) => {
    const armed = build.tool === "animal" && build.selectedSpeciesId === speciesId;
    setBuildMode(
      armed
        ? { active: false, tool: "none", selectedDefId: undefined, selectedSpeciesId: undefined }
        : { active: true, tool: "animal", selectedSpeciesId: speciesId, selectedDefId: undefined },
    );
  };

  const toggleClaim = () => {
    const armed = build.tool === "claim";
    setBuildMode(
      armed
        ? { active: false, tool: "none", selectedDefId: undefined, selectedSpeciesId: undefined }
        : { active: true, tool: "claim", selectedDefId: undefined, selectedSpeciesId: undefined },
    );
  };

  const buildings = TAB_CATEGORIES[tab]
    .flatMap((c) => buildingsByCategory(c))
    .filter((d) => d.id !== "entrance-arch");

  return (
    <div className="buildbar glass">
      <div className="buildbar__title">{TAB_TITLE[tab]}</div>

      {tab === "habitat" && (
        <div className="buildbar__biome-block">
          <p className="buildbar__hint">
            {selectedHabitat
              ? `Editing “${selectedHabitat.name}” — pick a biome below.`
              : "Pick a biome, fence a closed loop (or use Claim), then adopt matching animals."}
          </p>
          <div className="buildbar__strip buildbar__strip--biomes">
            {BIOMES.map((b) => (
              <button
                key={b.id}
                type="button"
                className={activeBiome === b.id ? "biome biome--on" : "biome"}
                onClick={() => pickBiome(b.id)}
                title={
                  selectedHabitat
                    ? `Set this habitat to ${b.label}`
                    : `New habitats will be ${b.label}`
                }
              >
                <span className="biome__icon" aria-hidden>
                  {b.icon}
                </span>
                <span className="biome__label">{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="buildbar__strip">
        {tab === "habitat" && (
          <button
            type="button"
            className={build.tool === "claim" ? "item item--on" : "item"}
            onClick={toggleClaim}
            title="Click inside a closed fence to register it as a habitat with the selected biome"
          >
            <span className="item__icon" aria-hidden>
              🗺️
            </span>
            <span className="item__name">Claim habitat</span>
            <span className="item__cost">Free</span>
          </button>
        )}

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
                  title={`${s.description} · Needs ${s.biome}`}
                >
                  <span className="item__icon" aria-hidden>
                    {s.icon}
                  </span>
                  <span className="item__name">{s.name}</span>
                  <span className="item__meta">{s.biome}</span>
                  <span className="item__cost">{money(s.cost)}</span>
                </button>
              );
            })
          : buildings.map((d) => {
              const armed =
                (build.tool === "place" || build.tool === "fence" || build.tool === "gate") &&
                build.selectedDefId === d.id;
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
