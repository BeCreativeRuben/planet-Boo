/**
 * Wildhaven — Jobs overview.
 *
 * Catalog of every staff role: what they do, hire/wage costs, and who is
 * currently employed. Hire more from the Staff build tab.
 */

import { useMemo } from "react";

import { JOB_OVERVIEWS, STAFF_ROLES_BY_ID } from "../game/staffTypes";
import type { StaffRole } from "../game/types";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";
import { parkCleanliness } from "../game/sanitation";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function JobsOverview() {
  const open = useUIStore((s) => s.jobsOpen);
  const close = useUIStore((s) => s.toggleJobs);
  const staff = useGameStore((s) => s.staff);
  const buildings = useGameStore((s) => s.buildings);
  const litter = useGameStore((s) => s.litter);
  const habitats = useGameStore((s) => s.habitats);
  const selectEntity = useGameStore((s) => s.selectEntity);

  const counts = useMemo(() => {
    const map: Partial<Record<StaffRole, number>> = {};
    for (const m of Object.values(staff)) {
      map[m.role] = (map[m.role] ?? 0) + 1;
    }
    return map;
  }, [staff]);

  const cleanliness = Math.round(parkCleanliness(buildings, litter));
  const litterCount = Object.keys(litter).length;
  const avgHygiene =
    Object.values(habitats).length === 0
      ? 100
      : Math.round(
          Object.values(habitats).reduce((n, h) => n + h.hygiene, 0) /
            Object.values(habitats).length,
        );
  const fullBins = Object.values(buildings).filter(
    (b) => b.defId === "trash-bin" && (b.fillLevel ?? 0) >= 90,
  ).length;

  if (!open) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Jobs overview">
      <div className="modal__scrim" onClick={close} />
      <div className="modal__card glass overview jobs-overview">
        <header className="modal__head">
          <h2>Jobs &amp; staff</h2>
          <button type="button" className="modal__close" aria-label="Close" onClick={close}>
            ×
          </button>
        </header>

        <p className="overview__lede">
          Every role that keeps Wildhaven running — hire from the Staff tab. Messy paths
          and dirty habitats hurt guest happiness and animal welfare.
        </p>

        <div className="jobs-overview__stats">
          <div className="jobs-overview__stat">
            <span className="stat__label">Park cleanliness</span>
            <span className="stat__value" style={{ color: cleanliness < 55 ? "#e0655a" : undefined }}>
              {cleanliness}%
            </span>
          </div>
          <div className="jobs-overview__stat">
            <span className="stat__label">Litter piles</span>
            <span className="stat__value">{litterCount}</span>
          </div>
          <div className="jobs-overview__stat">
            <span className="stat__label">Full bins</span>
            <span className="stat__value">{fullBins}</span>
          </div>
          <div className="jobs-overview__stat">
            <span className="stat__label">Avg habitat hygiene</span>
            <span className="stat__value" style={{ color: avgHygiene < 55 ? "#e0655a" : undefined }}>
              {avgHygiene}%
            </span>
          </div>
        </div>

        <div className="jobs-overview__list">
          {JOB_OVERVIEWS.map((job) => {
            const def = STAFF_ROLES_BY_ID[job.role];
            const hired = counts[job.role] ?? 0;
            const roster = Object.values(staff).filter((m) => m.role === job.role);
            return (
              <article key={job.role} className="jobs-card">
                <header className="jobs-card__head">
                  <span className="jobs-card__icon" aria-hidden>
                    {def.icon}
                  </span>
                  <div>
                    <h3>{job.title}</h3>
                    <p>{job.summary}</p>
                  </div>
                  <div className="jobs-card__meta">
                    <span>
                      Hire {money(def.hireCost)} · {money(def.wage)}/day
                    </span>
                    <strong style={{ color: hired === 0 ? "#e0655a" : "#5fc07a" }}>
                      {hired === 0 ? "None hired" : `${hired} on staff`}
                    </strong>
                  </div>
                </header>
                <ul className="jobs-card__duties">
                  {job.duties.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                {roster.length > 0 && (
                  <div className="jobs-card__roster">
                    {roster.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="jobs-card__chip"
                        title={`Energy ${Math.round(m.energy)}%`}
                        onClick={() => {
                          selectEntity({ kind: "staff", id: m.id });
                          close();
                        }}
                      >
                        {m.name} · {Math.round(m.energy)}%
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <p className="overview__hint">
          Tip: place Litter Bins on busy paths (Guest tab), then hire a Janitor. Habitat
          Cleaners deep-scrub enclosures — keepers alone only tidy lightly while feeding.
        </p>
      </div>
    </div>
  );
}
