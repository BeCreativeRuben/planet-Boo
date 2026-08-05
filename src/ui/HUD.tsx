/**
 * Wildhaven — HUD.
 *
 * The full in-game overlay that floats above the (parent-owned) 3D scene:
 *   • Top bar    — cash, day/time, guests, welfare, park rating, play/speed, finances
 *   • Left       — selected-entity inspector (animal welfare, habitat, building, staff, guest)
 *   • Right      — toast notifications
 *   • Bottom     — build toolbar (tabs) with the contextual BuildBar strip above it
 *
 * Game data + world mutations come from the simulation store; purely-UI state
 * (open tab, finance modal) comes from the UI store.
 */

import { getSpecies } from "../game/species";
import { getBuilding } from "../game/buildings";
import { getStaffRole } from "../game/staffTypes";
import { ledgerNet } from "../game/economy";
import type { BuildTool } from "../game/types";
import { useGameStore } from "../store/gameStore";
import { useUIStore, type BuildTab } from "../store/uiStore";
import { parkAppeal, welfareForAnimal } from "../store/selectors";

import BuildBar, { BIOMES } from "./BuildBar";
import AnimalPanel, { FactorBar, toneFor } from "./AnimalPanel";
import Notifications from "./Notifications";
import FinancePanel from "./FinancePanel";
import GuidePanel from "./GuidePanel";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** Signed currency for net, e.g. +$1,240 / -$320 */
function moneySigned(n: number): string {
  const r = Math.round(n);
  const abs = `$${Math.abs(r).toLocaleString()}`;
  if (r > 0) return `+${abs}`;
  if (r < 0) return `-${abs}`;
  return abs;
}
export default function HUD() {
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <div className="hud">
      <TopBar />

      <div className="hud__mid">
        <Inspector />
        <Notifications />
      </div>

      <div className="toolbar">
        {activeTab && <BuildBar tab={activeTab} />}
        <Toolbar />
      </div>

      <FinancePanel />
      <GuidePanel />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top bar                                                                   */
/* -------------------------------------------------------------------------- */

const SPEEDS = [1, 2, 3];

function dayPhase(t: number): string {
  if (t < 0.23) return "Night";
  if (t < 0.34) return "Dawn";
  if (t < 0.68) return "Midday";
  if (t < 0.82) return "Dusk";
  return "Night";
}

function stars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

function TopBar() {
  const cash = useGameStore((s) => s.finances.cash);
  const today = useGameStore((s) => s.finances.today);
  const day = useGameStore((s) => s.day);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const stats = useGameStore((s) => s.stats);
  const speed = useGameStore((s) => s.speed);
  const paused = useGameStore((s) => s.paused);
  const animals = useGameStore((s) => s.animals);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const setPaused = useGameStore((s) => s.setPaused);
  const toggleFinance = useUIStore((s) => s.toggleFinance);
  const toggleGuide = useUIStore((s) => s.toggleGuide);

  const appeal = parkAppeal(animals);
  const welfare = Math.round(stats.averageAnimalWelfare);
  const rating = Math.round(stats.rating);
  const net = ledgerNet(today);
  const netColor = net > 0 ? "#5fc07a" : net < 0 ? "#e0655a" : undefined;

  return (
    <div className="topbar glass">
      <div className="topbar__brand">
        <span className="leaf" aria-hidden>
          🌿
        </span>
        <b>Wildhaven</b>
      </div>

      <div
        className="stat stat--cash stat--clickable"
        onClick={toggleFinance}
        title="Open finances"
      >
        <span className="stat__label">Balance</span>
        <span className="stat__value">{money(cash)}</span>
      </div>

      <div
        className="stat stat--net stat--clickable"
        onClick={toggleFinance}
        title="Today's net profit / loss — open finances"
      >
        <span className="stat__label">Net today</span>
        <span className="stat__value" style={{ color: netColor }}>
          {moneySigned(net)}
        </span>
      </div>

      <div className="stat">
        <span className="stat__label">Day · {dayPhase(timeOfDay)}</span>
        <span className="stat__value">{day}</span>
      </div>

      <div className="stat">
        <span className="stat__label">Guests</span>
        <span className="stat__value">{stats.guestCount}</span>
      </div>

      <div className="stat">
        <span className="stat__label">Welfare</span>
        <span className="stat__value" style={{ color: toneFor(welfare) }}>
          {welfare}%
        </span>
      </div>

      <div className="stat">
        <span className="stat__label">Appeal</span>
        <span className="stat__value">{appeal}</span>
      </div>

      <div className="stat stat--rating">
        <span className="stat__label">Rating</span>
        <span className="stat__value stars">{stars(rating)}</span>
      </div>

      <div className="topbar__controls">
        <button
          type="button"
          className="ctrl"
          onClick={toggleGuide}
          title="Keeper's Guide — money & animal care"
        >
          ?
        </button>
        <button
          type="button"
          className={paused ? "ctrl ctrl--play" : "ctrl"}
          onClick={() => setPaused(!paused)}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? "▶" : "⏸"}
        </button>
        {SPEEDS.map((sp) => (
          <button
            key={sp}
            type="button"
            className={speed === sp && !paused ? "ctrl ctrl--active" : "ctrl"}
            onClick={() => {
              setPaused(false);
              setSpeed(sp);
            }}
          >
            {sp}×
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bottom toolbar (tabs)                                                     */
/* -------------------------------------------------------------------------- */

const TABS: { tab: BuildTab; icon: string; label: string }[] = [
  { tab: "habitat", icon: "🌿", label: "Habitat" },
  { tab: "scenery", icon: "🌳", label: "Scenery" },
  { tab: "guest", icon: "🍔", label: "Guest" },
  { tab: "staff", icon: "🧑‍🌾", label: "Staff" },
  { tab: "animals", icon: "🦁", label: "Animals" },
];

function Toolbar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const tool = useGameStore((s) => s.build.tool);
  const setBuildMode = useGameStore((s) => s.setBuildMode);

  const selectTab = (tab: BuildTab) => {
    setActiveTab(tab);
    const open = useUIStore.getState().activeTab;
    setBuildMode({
      active: open !== null,
      tool: "none",
      selectedDefId: undefined,
      selectedSpeciesId: undefined,
    });
  };

  const toggleDelete = () => {
    const next: BuildTool = tool === "delete" ? "none" : "delete";
    setActiveTab(null);
    setBuildMode({
      active: next === "delete",
      tool: next,
      selectedDefId: undefined,
      selectedSpeciesId: undefined,
    });
  };

  return (
    <div className="toolbar__tabs glass">
      {TABS.map((t) => (
        <button
          key={t.tab}
          type="button"
          className={activeTab === t.tab ? "tab tab--active" : "tab"}
          onClick={() => selectTab(t.tab)}
        >
          <span className="tab__icon" aria-hidden>
            {t.icon}
          </span>
          <span className="tab__label">{t.label}</span>
        </button>
      ))}
      <button
        type="button"
        className={tool === "delete" ? "tab tab--danger tab--active" : "tab tab--danger"}
        onClick={toggleDelete}
      >
        <span className="tab__icon" aria-hidden>
          🗑️
        </span>
        <span className="tab__label">Demolish</span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Left inspector                                                            */
/* -------------------------------------------------------------------------- */

function Inspector() {
  const selection = useGameStore((s) => s.selection);
  if (!selection) return null;

  switch (selection.kind) {
    case "animal":
      return <AnimalInspector id={selection.id} />;
    case "habitat":
      return <HabitatInspector id={selection.id} />;
    case "building":
      return <BuildingInspector id={selection.id} />;
    case "staff":
      return <StaffInspector id={selection.id} />;
    default:
      return null;
  }
}

function AnimalInspector({ id }: { id: string }) {
  const a = useGameStore((s) => s.animals[id]);
  const w = welfareForAnimal(id);
  if (!a || !w) return null;
  const species = getSpecies(a.speciesId);

  return (
    <div className="inspector glass">
      <header className="inspector__head">
        <span className="inspector__icon" aria-hidden>
          {species?.icon ?? "🐾"}
        </span>
        <div className="inspector__title">
          <h3>{a.name}</h3>
          <p>{species?.name}</p>
        </div>
        <span className="inspector__score" style={{ color: toneFor(w.score) }}>
          {w.score}
        </span>
      </header>
      <AnimalPanel id={id} />
    </div>
  );
}

function HabitatInspector({ id }: { id: string }) {
  const h = useGameStore((s) => s.habitats[id]);
  const setHabitatBiome = useGameStore((s) => s.setHabitatBiome);
  if (!h) return null;
  const species = h.speciesId ? getSpecies(h.speciesId) : undefined;
  return (
    <div className="inspector glass">
      <header className="inspector__head">
        <span className="inspector__icon" aria-hidden>
          {species?.icon ?? "🏞️"}
        </span>
        <div className="inspector__title">
          <h3>{h.name}</h3>
          <p>
            {h.biome} · {h.area} m² · {h.animalIds.length} animals
          </p>
        </div>
      </header>

      <p className="inspector__note">Biome (must match the animals you keep here)</p>
      <div className="inspector__biomes">
        {BIOMES.map((b) => (
          <button
            key={b.id}
            type="button"
            className={h.biome === b.id ? "biome biome--on" : "biome"}
            onClick={() => setHabitatBiome(id, b.id)}
            title={`Set habitat to ${b.label}`}
          >
            <span className="biome__icon" aria-hidden>
              {b.icon}
            </span>
            <span className="biome__label">{b.label}</span>
          </button>
        ))}
      </div>

      <div className="factors">
        <FactorBar label="Temp" value={Math.min(100, (h.temperature + 20) * 1.6)} />
        <FactorBar label="Humidity" value={h.humidity} />
        <FactorBar label="Hygiene" value={h.hygiene} />
      </div>
      {h.enrichmentProvided.length > 0 && (
        <p className="inspector__note">
          Enrichment: {h.enrichmentProvided.join(", ")}
        </p>
      )}
    </div>
  );
}

function BuildingInspector({ id }: { id: string }) {
  const b = useGameStore((s) => s.buildings[id]);
  const demolish = useGameStore((s) => s.demolish);
  if (!b) return null;
  const def = getBuilding(b.defId);
  if (!def) return null;
  return (
    <div className="inspector glass">
      <header className="inspector__head">
        <span className="inspector__icon" aria-hidden>
          {def.icon ?? "🏗️"}
        </span>
        <div className="inspector__title">
          <h3>{def.name}</h3>
          <p>{def.category}</p>
        </div>
      </header>
      <div className="factors">
        <FactorBar label="Condition" value={b.condition} />
      </div>
      <p className="inspector__note">{def.description}</p>
      <button type="button" className="btn btn--danger" onClick={() => demolish(id)}>
        Demolish
      </button>
    </div>
  );
}

function StaffInspector({ id }: { id: string }) {
  const m = useGameStore((s) => s.staff[id]);
  if (!m) return null;
  const def = getStaffRole(m.role);
  return (
    <div className="inspector glass">
      <header className="inspector__head">
        <span className="inspector__icon" aria-hidden>
          {def.icon}
        </span>
        <div className="inspector__title">
          <h3>{m.name}</h3>
          <p>{def.description}</p>
        </div>
      </header>
      <div className="factors">
        <FactorBar label="Energy" value={m.energy} />
      </div>
    </div>
  );
}
