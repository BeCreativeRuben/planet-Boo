/**
 * Wildhaven — animal welfare panel.
 *
 * The body of the left-hand inspector when an animal is selected. It renders the
 * full welfare breakdown (one bar per factor) plus a little species context, and
 * a button to snap the camera onto the animal.
 *
 * Two small helpers are exported alongside it because the HUD and other panels
 * reuse them for consistent colours and bars:
 *   • {@link toneFor}   — maps a 0..100 score to a traffic-light colour
 *   • {@link FactorBar} — a labelled 0..100 progress bar
 */

import { getSpecies } from "../game/species";
import { welfareLabel } from "../game/welfare";
import { welfareForAnimal } from "../store/selectors";
import { useGameStore } from "../store/gameStore";

/** Traffic-light colour for a 0..100 welfare / factor score. */
export function toneFor(value: number): string {
  if (value >= 70) return "#5fc07a";
  if (value >= 45) return "#e6b04a";
  return "#e0655a";
}

/** A labelled 0..100 progress bar, tinted by its own value. */
export function FactorBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="factor">
      <span className="factor__label">{label}</span>
      <span className="factor__track">
        <span
          className="factor__fill"
          style={{ width: `${v}%`, background: toneFor(v) }}
        />
      </span>
      <span className="factor__pct" style={{ color: toneFor(v) }}>
        {Math.round(v)}
      </span>
    </div>
  );
}

const CONSERVATION_LABEL: Record<string, string> = {
  LC: "Least Concern",
  NT: "Near Threatened",
  VU: "Vulnerable",
  EN: "Endangered",
  CR: "Critically Endangered",
  EW: "Extinct in the Wild",
};

export default function AnimalPanel({ id }: { id: string }) {
  const animal = useGameStore((s) => s.animals[id]);
  const focusAnimal = useGameStore((s) => s.focusAnimal);
  const focusAnimalId = useGameStore((s) => s.focusAnimalId);

  const welfare = welfareForAnimal(id);
  if (!animal || !welfare) return null;

  const species = getSpecies(animal.speciesId);
  const years = (animal.age / 52).toFixed(1);
  const focused = focusAnimalId === id;

  return (
    <div className="animal-panel">
      <div className="animal-panel__verdict">
        <span
          className="animal-panel__label"
          style={{ color: toneFor(welfare.score) }}
        >
          {welfareLabel(welfare.score)}
        </span>
        {species && (
          <span className="animal-panel__status" title="Conservation status">
            {CONSERVATION_LABEL[species.conservationStatus] ??
              species.conservationStatus}
          </span>
        )}
      </div>

      <div className="factors">
        {welfare.factors.map((f) => (
          <FactorBar key={f.key} label={f.label} value={f.value} />
        ))}
      </div>

      <dl className="animal-panel__facts">
        <div>
          <dt>Sex</dt>
          <dd>{animal.sex === "male" ? "♂ Male" : "♀ Female"}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{years} yrs</dd>
        </div>
        {species && (
          <div>
            <dt>Diet</dt>
            <dd className="cap">{species.diet}</dd>
          </div>
        )}
        {species && (
          <div>
            <dt>Appeal</dt>
            <dd>{species.appeal}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        className={focused ? "btn btn--ghost btn--on" : "btn btn--ghost"}
        onClick={() => focusAnimal(focused ? null : id)}
      >
        {focused ? "Following" : "Focus camera"}
      </button>
    </div>
  );
}
