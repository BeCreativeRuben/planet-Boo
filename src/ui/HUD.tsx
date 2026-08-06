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

import { useEffect, type ReactNode } from "react";
import { getSpecies } from "../game/species";
import { getBuilding } from "../game/buildings";
import { getStaffRole } from "../game/staffTypes";
import {
  ledgerNet,
  shopOpenFactor,
  shopOpenLabel,
  transactionRevenue,
  vendorBoost,
  entranceOpenLabel,
} from "../game/economy";
import {
  lotStallCapacity,
  parkingLotCarCounts,
  parkingSummary,
} from "../game/parking";
import {
  formatClockTime,
  getDayPhase,
  isNightPhase,
  phaseHint,
  phaseLabel,
} from "../game/dayCycle";
import type { BuildTool } from "../game/types";
import { escapeDismissAction } from "../game/escapeDismiss";
import { useGameStore } from "../store/gameStore";
import { useUIStore, type BuildTab } from "../store/uiStore";
import { parkAppeal, welfareForAnimal } from "../store/selectors";

import BuildBar, { BIOMES } from "./BuildBar";
import AnimalPanel, { FactorBar, toneFor } from "./AnimalPanel";
import Notifications from "./Notifications";
import FinancePanel from "./FinancePanel";
import LandSurveyHud from "./LandSurveyHud";
import GuidePanel from "./GuidePanel";
import AnimalOverview from "./AnimalOverview";
import JobsOverview from "./JobsOverview";
import { InspectorFrame } from "./InspectorFrame";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** Signed currency for net, e.g. +$1,240 / -$320 */
function moneySigned(n: number): string {
  const r = Math.round(n);
  const abs = `$${Math.abs(r).toLocaleString()}`;
  if (r > 0) return `+${abs}`;
  if (r < 0) return `-${abs}`;
  return abs;
}

/** Escape: close overlays first, then build tools, then clear the inspector selection. */
function useEscapeDismiss() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const ui = useUIStore.getState();
      const game = useGameStore.getState();
      const action = escapeDismissAction({
        landSelectOpen: ui.landSelectOpen,
        financeOpen: ui.financeOpen,
        guideOpen: ui.guideOpen,
        animalsOpen: ui.animalsOpen,
        jobsOpen: ui.jobsOpen,
        activeTab: ui.activeTab,
        buildActive: game.build.active,
        buildTool: game.build.tool,
        hasSelection: !!game.selection,
        hasFocusAnimal: !!game.focusAnimalId,
      });
      if (action === "none") return;

      if (action === "land-survey") ui.closeLandSelect();
      else if (action === "overlays") ui.closeOverlays();
      else if (action === "build") {
        ui.setActiveTab(null);
        game.setBuildMode({
          active: false,
          tool: "none",
          selectedDefId: undefined,
          selectedSpeciesId: undefined,
        });
      } else if (action === "selection") {
        game.selectEntity(null);
        game.focusAnimal(null);
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function HUD() {
  const activeTab = useUIStore((s) => s.activeTab);
  const landSelectOpen = useUIStore((s) => s.landSelectOpen);
  useEscapeDismiss();

  return (
    <div className={`hud${landSelectOpen ? " hud--land-survey" : ""}`}>
      <TopBar />
      {!landSelectOpen && <PhaseBanner />}

      {!landSelectOpen && (
        <div className={`hud__mid${activeTab ? " hud__mid--build-open" : ""}`}>
          <Inspector compact={!!activeTab} />
          <Notifications />
        </div>
      )}

      {!landSelectOpen && (
        <div className="toolbar">
          <Toolbar />
          {activeTab && <BuildBar tab={activeTab} />}
        </div>
      )}

      <LandSurveyHud />
      <FinancePanel />
      <GuidePanel />
      <AnimalOverview />
      <JobsOverview />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top bar                                                                   */
/* -------------------------------------------------------------------------- */

const SPEEDS = [1, 2, 3];

function stars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

function PhaseBanner() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const speed = useGameStore((s) => s.speed);
  const paused = useGameStore((s) => s.paused);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const setPaused = useGameStore((s) => s.setPaused);
  const phase = getDayPhase(timeOfDay);
  if (!isNightPhase(phase)) return null;

  return (
    <div className="phase-banner" role="status">
      <div className="phase-banner__mark" aria-hidden>
        <span className="phase-banner__moon" />
      </div>
      <div className="phase-banner__copy">
        <strong className="phase-banner__title">Night maintenance</strong>
        <p className="phase-banner__hint">Staff work faster — or skip to dawn.</p>
      </div>
      <div className="phase-banner__actions">
        {[2, 3].map((sp) => (
          <button
            key={sp}
            type="button"
            className={
              speed === sp && !paused
                ? "phase-banner__speed phase-banner__speed--on"
                : "phase-banner__speed"
            }
            onClick={() => {
              setPaused(false);
              setSpeed(sp);
            }}
            title={`Run at ${sp}× to skip the night`}
          >
            {sp}×
          </button>
        ))}
      </div>
    </div>
  );
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
  const toggleAnimals = useUIStore((s) => s.toggleAnimals);
  const toggleJobs = useUIStore((s) => s.toggleJobs);

  const appeal = parkAppeal(animals);
  const welfare = Math.round(stats.averageAnimalWelfare);
  const rating = Math.round(stats.rating);
  const net = ledgerNet(today);
  const netColor = net > 0 ? "#5fc07a" : net < 0 ? "#e0655a" : undefined;
  const phase = getDayPhase(timeOfDay);

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

      <div
        className="stat stat--clock"
        title={`${phaseHint(phase)} · Day ${day}`}
      >
        <span className="stat__label">
          Day {day} · {phaseLabel(phase)}
        </span>
        <span className="stat__value stat__value--clock">
          {formatClockTime(timeOfDay)}
        </span>
      </div>

      <div className="stat">
        <span className="stat__label">Guests</span>
        <span className="stat__value">{stats.guestCount}</span>
      </div>

      <div
        className="stat stat--clickable"
        onClick={toggleAnimals}
        title="Animal overview — all animals in the park"
      >
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
          onClick={toggleAnimals}
          title="Animal overview"
        >
          🐾
        </button>
        <button
          type="button"
          className="ctrl"
          onClick={toggleJobs}
          title="Jobs & staff — roles overview"
        >
          👷
        </button>
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

function Inspector({ compact }: { compact?: boolean }) {
  const selection = useGameStore((s) => s.selection);
  if (!selection) return null;

  let panel: ReactNode = null;
  switch (selection.kind) {
    case "animal":
      panel = <AnimalInspector id={selection.id} compact={compact} />;
      break;
    case "habitat":
      panel = <HabitatInspector id={selection.id} compact={compact} />;
      break;
    case "building":
      panel = <BuildingInspector id={selection.id} compact={compact} />;
      break;
    case "staff":
      panel = <StaffInspector id={selection.id} compact={compact} />;
      break;
    default:
      return null;
  }
  return panel;
}

function AnimalInspector({ id, compact }: { id: string; compact?: boolean }) {
  const a = useGameStore((s) => s.animals[id]);
  const w = welfareForAnimal(id);
  if (!a || !w) return null;
  const species = getSpecies(a.speciesId);

  return (
    <InspectorFrame compact={compact}>
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
    </InspectorFrame>
  );
}

function HabitatInspector({ id, compact }: { id: string; compact?: boolean }) {
  const h = useGameStore((s) => s.habitats[id]);
  const setHabitatBiome = useGameStore((s) => s.setHabitatBiome);
  if (!h) return null;
  const species = h.speciesId ? getSpecies(h.speciesId) : undefined;
  return (
    <InspectorFrame compact={compact}>
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
    </InspectorFrame>
  );
}

function BuildingInspector({ id, compact }: { id: string; compact?: boolean }) {
  const b = useGameStore((s) => s.buildings[id]);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const guests = useGameStore((s) => s.guests);
  const staff = useGameStore((s) => s.staff);
  const buildings = useGameStore((s) => s.buildings);
  const ticketPrice = useGameStore((s) => s.finances.ticketPrice);
  const avgHappy = useGameStore((s) => s.stats.averageGuestHappiness);
  const demolish = useGameStore((s) => s.demolish);
  if (!b) return null;
  const def = getBuilding(b.defId);
  if (!def) return null;

  const isShop = !!def.revenuePerUse;
  const isEntrance = b.defId === "entrance-arch";
  const isParking = b.defId === "parking-lot";
  const isTrash = b.defId === "trash-bin";
  const openFactor = shopOpenFactor(timeOfDay, b.condition);
  const openLabel = shopOpenLabel(openFactor, b.condition);
  const guestCount = Object.keys(guests).length;
  const parking = parkingSummary(buildings, guestCount);
  const carsHere = isParking
    ? (parkingLotCarCounts(buildings, guestCount)[b.instanceId] ?? 0)
    : 0;
  const stallsHere = isParking ? lotStallCapacity(b) : 0;
  const gateLabel = entranceOpenLabel(timeOfDay, b.condition);
  const vendorCount = Object.values(staff).filter((m) => m.role === "vendor").length;
  const estDay =
    isShop && def.revenuePerUse
      ? transactionRevenue(def, avgHappy) * guestCount * 0.12 * vendorBoost(vendorCount)
      : 0;
  const sales = b.salesToday ?? 0;
  const customers = Math.round(b.customersToday ?? 0);
  const salesLife = b.salesLifetime ?? 0;
  const customersLife = Math.round(b.customersLifetime ?? 0);

  return (
    <InspectorFrame compact={compact}>
      <header className="inspector__head">
        <span className="inspector__icon" aria-hidden>
          {def.icon ?? "🏗️"}
        </span>
        <div className="inspector__title">
          <h3>{def.name}</h3>
          <p>{def.category}</p>
        </div>
      </header>

      {isEntrance && (
        <>
          <p
            className="inspector__note"
            style={{ color: openFactor > 0 ? "#5fc07a" : "#e0655a", fontWeight: 700 }}
          >
            {gateLabel}
          </p>
          <dl className="animal-panel__facts">
            <div>
              <dt>Guests in park</dt>
              <dd>{guestCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Parking</dt>
              <dd>{parking.label}</dd>
            </div>
            <div>
              <dt>Guest capacity</dt>
              <dd>{parking.capacity}</dd>
            </div>
            <div>
              <dt>Ticket</dt>
              <dd>${ticketPrice}</dd>
            </div>
          </dl>
          <p className="inspector__note">
            Guests arrive through parking. More lots raise capacity — spaces nearest
            the gate fill first. Keep asphalt maintained so crowds keep coming.
          </p>
        </>
      )}

      {isParking && (
        <>
          <p
            className="inspector__note"
            style={{
              color: b.condition < 40 ? "#e0655a" : "#5fc07a",
              fontWeight: 700,
            }}
          >
            {parking.label}
          </p>
          <dl className="animal-panel__facts">
            <div>
              <dt>Lots</dt>
              <dd>{parking.lots}</dd>
            </div>
            <div>
              <dt>Cars here</dt>
              <dd>
                {carsHere}/{stallsHere}
              </dd>
            </div>
            <div>
              <dt>Parked (all)</dt>
              <dd>
                {parking.carsParked}/{parking.stalls}
              </dd>
            </div>
            <div>
              <dt>Guest capacity</dt>
              <dd>{parking.capacity}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{Math.round(b.condition)}%</dd>
            </div>
          </dl>
          <p className="inspector__note">
            All lots share one occupancy pool — spaces closer to the entrance fill
            first. Hire mechanics to patch cracks; place extra lots (Guest tab) after
            expanding for more capacity.
          </p>
        </>
      )}

      {isTrash && (
        <>
          <div className="factors">
            <FactorBar label="Fill" value={Math.round(b.fillLevel ?? 0)} />
          </div>
          <p className="inspector__note">
            {(b.fillLevel ?? 0) >= 95
              ? "Overflowing — guests will litter the path instead. Hire a janitor."
              : (b.fillLevel ?? 0) >= 60
                ? "Getting full. Janitors empty bins on their rounds."
                : "Ready for guests. Place bins on busy paths."}
          </p>
        </>
      )}

      {isShop && (
        <>
          <p
            className="inspector__note"
            style={{ color: openFactor > 0 ? "#5fc07a" : "#e0655a", fontWeight: 700 }}
          >
            {openLabel}
          </p>
          <dl className="animal-panel__facts">
            <div>
              <dt>Sales today</dt>
              <dd>${Math.round(sales).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Customers today</dt>
              <dd>{customers.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Lifetime sales</dt>
              <dd>${Math.round(salesLife).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Lifetime guests</dt>
              <dd>{customersLife.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Est. / day</dt>
              <dd>${Math.round(estDay).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Per sale</dt>
              <dd>~${Math.round(transactionRevenue(def, avgHappy))}</dd>
            </div>
          </dl>
          <div className="factors">
            <FactorBar label="Open now" value={Math.round(openFactor * 100)} />
          </div>
          {vendorCount === 0 && (
            <p className="inspector__note">
              No vendors hired — hire vendors in the Staff tab to boost sales.
            </p>
          )}
        </>
      )}

      <div className="factors">
        <FactorBar label="Condition" value={b.condition} />
      </div>
      {def.upkeep != null && def.upkeep > 0 && (
        <p className="inspector__note">Upkeep ${def.upkeep}/day</p>
      )}
      <p className="inspector__note">{def.description}</p>
      {!isEntrance && (
        <button type="button" className="btn btn--danger" onClick={() => demolish(id)}>
          Demolish
        </button>
      )}
    </InspectorFrame>
  );
}

function StaffInspector({ id, compact }: { id: string; compact?: boolean }) {
  const m = useGameStore((s) => s.staff[id]);
  const habitats = useGameStore((s) => s.habitats);
  if (!m) return null;
  const def = getStaffRole(m.role);
  const assignmentNames = m.assignments
    .map((hid) => habitats[hid]?.name)
    .filter(Boolean) as string[];
  return (
    <InspectorFrame compact={compact}>
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
      <p className="inspector__note">
        {m.role === "keeper"
          ? "Feeds the hungriest animals and gives a light tidy while working."
          : m.role === "cleaner"
            ? "Deep-cleans the dirtiest habitats so hygiene stays high."
            : m.role === "vet"
              ? "Treats sick and injured animals across the park."
              : m.role === "janitor"
                ? "Empties litter bins and picks up trash on guest paths."
                : m.role === "mechanic"
                  ? "Slows wear on fences and facilities."
                  : "Staffs shops so guest spending stays high."}
      </p>
      {assignmentNames.length > 0 && (
        <p className="inspector__note">
          Assigned: {assignmentNames.join(", ")}
        </p>
      )}
    </InspectorFrame>
  );
}
