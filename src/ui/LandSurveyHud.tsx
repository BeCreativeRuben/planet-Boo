import { listBuyableParcels, ownedExtent } from "../game/parcels";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";

function money(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString()}`;
}

export default function LandSurveyHud() {
  const open = useUIStore((s) => s.landSelectOpen);
  const close = useUIStore((s) => s.closeLandSelect);
  const openFinance = useUIStore((s) => s.openFinance);
  const cash = useGameStore((s) => s.finances.cash);
  const ownedParcels = useGameStore((s) => s.ownedParcels);

  if (!open) return null;

  const extent = ownedExtent(ownedParcels);
  const buyable = listBuyableParcels(ownedParcels);
  const cheapest = buyable[0];
  const maxed = buyable.length === 0;

  return (
    <div className="land-survey" role="dialog" aria-label="Survey park land">
      <div className="land-survey__banner glass">
        <div className="land-survey__title">
          <h2>Survey park land</h2>
          <p>
            Top-down map of the whole park. Amber plots are for sale — south is the
            entrance and parking. Pan and zoom; rotation is locked.
          </p>
        </div>
        <div className="land-survey__stats">
          <div className="land-survey__stat">
            <span>Balance</span>
            <strong style={{ color: cash < 0 ? "#e0655a" : undefined }}>{money(cash)}</strong>
          </div>
          <div className="land-survey__stat">
            <span>Owned</span>
            <strong>
              {ownedParcels.length} · {Math.round(extent.width)}×{Math.round(extent.depth)} m
            </strong>
          </div>
          <div className="land-survey__stat">
            <span>{maxed ? "Status" : "Cheapest"}</span>
            <strong>
              {maxed
                ? "Map full"
                : `${cheapest!.direction} · ${money(cheapest!.cost)}`}
            </strong>
          </div>
        </div>
        <div className="land-survey__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              close();
              openFinance();
            }}
          >
            Finances
          </button>
          <button type="button" className="btn" onClick={close}>
            Done
          </button>
        </div>
      </div>

      <div className="land-survey__legend glass" aria-hidden>
        <div className="land-survey__swatch land-survey__swatch--owned" />
        <span>Owned</span>
        <div className="land-survey__swatch land-survey__swatch--buy" />
        <span>For sale</span>
        <div className="land-survey__swatch land-survey__swatch--locked" />
        <span>Locked</span>
        <span className="land-survey__compass-hint">N ↑ · S entrance</span>
      </div>
    </div>
  );
}
