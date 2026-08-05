/**
 * Wildhaven — animal overview.
 *
 * Park-wide roster of every animal: species, habitat, welfare, hunger, health.
 * Click a row to select and focus the camera on that animal.
 */

import { useMemo, useState } from "react";

import { getSpecies } from "../game/species";
import { welfareLabel } from "../game/welfare";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";
import { toneFor } from "./AnimalPanel";

type SortKey = "name" | "species" | "habitat" | "welfare" | "hunger" | "health";

interface Row {
  id: string;
  name: string;
  speciesId: string;
  speciesName: string;
  icon: string;
  habitatName: string;
  welfare: number;
  hunger: number;
  health: number;
  sick: boolean;
}

export default function AnimalOverview() {
  const open = useUIStore((s) => s.animalsOpen);
  const close = useUIStore((s) => s.toggleAnimals);
  const animals = useGameStore((s) => s.animals);
  const habitats = useGameStore((s) => s.habitats);
  const selectEntity = useGameStore((s) => s.selectEntity);
  const focusAnimal = useGameStore((s) => s.focusAnimal);

  const [sort, setSort] = useState<SortKey>("welfare");
  const [asc, setAsc] = useState(true);
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const list: Row[] = Object.values(animals).map((a) => {
      const sp = getSpecies(a.speciesId);
      const habitat = a.habitatId ? habitats[a.habitatId] : undefined;
      return {
        id: a.id,
        name: a.name,
        speciesId: a.speciesId,
        speciesName: sp?.name ?? a.speciesId,
        icon: sp?.icon ?? "🐾",
        habitatName: habitat?.name ?? "Unassigned",
        welfare: Math.round(a.welfare),
        hunger: Math.round(a.hunger),
        health: Math.round(a.health),
        sick: a.sick,
      };
    });

    const q = filter.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.speciesName.toLowerCase().includes(q) ||
            r.habitatName.toLowerCase().includes(q),
        )
      : list;

    const dir = asc ? 1 : -1;
    filtered.sort((a, b) => {
      const pick = (r: Row): string | number => {
        switch (sort) {
          case "species":
            return r.speciesName;
          case "habitat":
            return r.habitatName;
          default:
            return r[sort];
        }
      };
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return filtered;
  }, [animals, habitats, sort, asc, filter]);

  if (!open) return null;

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      // Welfare/hunger/health: lowest first is most actionable.
      setAsc(key === "welfare" || key === "hunger" || key === "health");
    }
  };

  const onSelect = (id: string) => {
    selectEntity({ kind: "animal", id });
    focusAnimal(id);
    close();
  };

  const critical = rows.filter((r) => r.welfare < 45 || r.hunger <= 20 || r.health <= 25).length;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Animal overview">
      <div className="modal__scrim" onClick={close} />
      <div className="modal__card glass overview">
        <header className="modal__head">
          <h2>Animals</h2>
          <button type="button" className="modal__close" aria-label="Close" onClick={close}>
            ×
          </button>
        </header>

        <div className="overview__meta">
          <p>
            {rows.length} animal{rows.length === 1 ? "" : "s"}
            {critical > 0 ? (
              <>
                {" "}
                · <span className="overview__warn">{critical} need attention</span>
              </>
            ) : null}
          </p>
          <input
            type="search"
            className="overview__search"
            placeholder="Search name, species, habitat…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter animals"
          />
        </div>

        {rows.length === 0 ? (
          <p className="overview__empty">
            {filter
              ? "No animals match that search."
              : "No animals yet — adopt some from the Animals tab."}
          </p>
        ) : (
          <div className="overview__table-wrap">
            <table className="overview__table">
              <thead>
                <tr>
                  <Th label="Name" active={sort === "name"} asc={asc} onClick={() => toggleSort("name")} />
                  <Th
                    label="Species"
                    active={sort === "species"}
                    asc={asc}
                    onClick={() => toggleSort("species")}
                  />
                  <Th
                    label="Habitat"
                    active={sort === "habitat"}
                    asc={asc}
                    onClick={() => toggleSort("habitat")}
                  />
                  <Th
                    label="Welfare"
                    active={sort === "welfare"}
                    asc={asc}
                    onClick={() => toggleSort("welfare")}
                  />
                  <Th
                    label="Fed"
                    active={sort === "hunger"}
                    asc={asc}
                    onClick={() => toggleSort("hunger")}
                  />
                  <Th
                    label="Health"
                    active={sort === "health"}
                    asc={asc}
                    onClick={() => toggleSort("health")}
                  />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const alert = r.welfare < 45 || r.hunger <= 20 || r.health <= 25 || r.sick;
                  return (
                    <tr
                      key={r.id}
                      className={alert ? "overview__row overview__row--alert" : "overview__row"}
                      onClick={() => onSelect(r.id)}
                      title={`${welfareLabel(r.welfare)} — click to focus`}
                    >
                      <td>
                        <span className="overview__name">
                          <span aria-hidden>{r.icon}</span> {r.name}
                          {r.sick ? <span className="overview__tag">sick</span> : null}
                        </span>
                      </td>
                      <td>{r.speciesName}</td>
                      <td>{r.habitatName}</td>
                      <td style={{ color: toneFor(r.welfare) }}>{r.welfare}%</td>
                      <td style={{ color: toneFor(r.hunger) }}>{r.hunger}%</td>
                      <td style={{ color: toneFor(r.health) }}>{r.health}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <th>
      <button type="button" className={active ? "overview__th overview__th--on" : "overview__th"} onClick={onClick}>
        {label}
        {active ? (asc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
