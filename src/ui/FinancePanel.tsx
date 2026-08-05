/**
 * Wildhaven — finance modal.
 *
 * A centered overlay (toggled from the top bar's balance chip) that shows the
 * park's books: current balance and conservation points, a ticket-price slider,
 * today's running income / expense ledger, and a short history of settled days.
 */

import {
  dailyAnimalCosts,
  dailyStaffWages,
  dailyUpkeep,
  ledgerExpense,
  ledgerIncome,
  ledgerNet,
  TICKET_PRICE_RANGE,
} from "../game/economy";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";
import {
  PARCELS_AXIS,
  listBuyableParcels,
  ownedExtent,
  parcelKey,
} from "../game/parcels";

/** Signed currency, e.g. -$1,240. */
function money(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString()}`;
}

function Row({
  label,
  value,
  kind,
  hint,
}: {
  label: string;
  value: number;
  kind?: "in" | "out";
  hint?: string;
}) {
  const sign = kind === "out" ? -1 : 1;
  return (
    <div className="ledger__row">
      <span className="ledger__label">
        {label}
        {hint ? <span className="ledger__hint"> · {hint}</span> : null}
      </span>
      <span
        className={kind === "out" ? "ledger__val ledger__val--out" : "ledger__val"}
      >
        {money(sign * value)}
      </span>
    </div>
  );
}

export default function FinancePanel() {
  const open = useUIStore((s) => s.financeOpen);
  const close = useUIStore((s) => s.toggleFinance);
  const openLandSelect = useUIStore((s) => s.openLandSelect);

  const finances = useGameStore((s) => s.finances);
  const animals = useGameStore((s) => s.animals);
  const staff = useGameStore((s) => s.staff);
  const buildings = useGameStore((s) => s.buildings);
  const ownedParcels = useGameStore((s) => s.ownedParcels);
  const setTicketPrice = useGameStore((s) => s.setTicketPrice);

  if (!open) return null;

  const today = finances.today;
  const income = ledgerIncome(today);
  const expense = ledgerExpense(today);
  const net = ledgerNet(today);
  const foodDay = dailyAnimalCosts(animals);
  const wageDay = dailyStaffWages(staff);
  const upkeepDay = dailyUpkeep(buildings);
  const [minPrice, maxPrice] = TICKET_PRICE_RANGE;
  const extent = ownedExtent(ownedParcels);
  const buyable = listBuyableParcels(ownedParcels);
  const buyableMap = new Map(buyable.map((b) => [b.key, b]));
  const maxed = buyable.length === 0;
  const ownedSet = new Set(ownedParcels);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Finances">
      <div className="modal__scrim" onClick={close} />
      <div className="modal__card glass">
        <header className="modal__head">
          <h2>Park Finances</h2>
          <button
            type="button"
            className="modal__close"
            aria-label="Close"
            onClick={close}
          >
            ×
          </button>
        </header>

        <div className="finance__summary">
          <div className="finance__big">
            <span className="finance__big-label">Balance</span>
            <span
              className="finance__big-value"
              style={{ color: finances.cash < 0 ? "#e0655a" : undefined }}
            >
              {money(finances.cash)}
            </span>
          </div>
          <div className="finance__big">
            <span className="finance__big-label">Conservation</span>
            <span className="finance__big-value">
              {finances.conservationPoints} pts
            </span>
          </div>
        </div>

        <div className="finance__price">
          <div className="finance__price-head">
            <span>Ticket price</span>
            <strong>{money(finances.ticketPrice)}</strong>
          </div>
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step={1}
            value={finances.ticketPrice}
            onChange={(e) => setTicketPrice(Number(e.target.value))}
          />
          <p className="finance__hint">
            Higher prices earn more per guest but thin the crowds.
          </p>
        </div>

        <div className="finance__land">
          <div className="finance__price-head">
            <span>Park land</span>
            <strong>
              {ownedParcels.length} plots · {Math.round(extent.width)}×{Math.round(extent.depth)} m
            </strong>
          </div>
          <p className="finance__hint">
            {maxed
              ? "You've bought every reachable parcel."
              : "Expand on a top-down map of the whole park — compass sides and prices are labelled on each plot."}
          </p>
          <div className="parcel-map parcel-map--preview" role="img" aria-label="Park land overview">
            <span className="parcel-map__edge parcel-map__edge--n">N</span>
            <span className="parcel-map__edge parcel-map__edge--s">S</span>
            <span className="parcel-map__edge parcel-map__edge--w">W</span>
            <span className="parcel-map__edge parcel-map__edge--e">E</span>
            {Array.from({ length: PARCELS_AXIS }, (_, row) => {
              const pz = PARCELS_AXIS - 1 - row;
              return (
                <div key={pz} className="parcel-map__row">
                  {Array.from({ length: PARCELS_AXIS }, (_, px) => {
                    const key = parcelKey(px, pz);
                    const owned = ownedSet.has(key);
                    const offer = buyableMap.get(key);
                    const cls = owned
                      ? "parcel-map__cell parcel-map__cell--owned"
                      : offer
                        ? "parcel-map__cell parcel-map__cell--buy"
                        : "parcel-map__cell";
                    return (
                      <div
                        key={key}
                        className={cls}
                        title={
                          owned
                            ? `Owned (${px},${pz})`
                            : offer
                              ? `${offer.direction} · ${money(offer.cost)}`
                              : "Locked"
                        }
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          {!maxed && (
            <>
              {buyable[0] && (
                <p className="finance__hint">
                  Cheapest adjacent: {buyable[0].direction} · {money(buyable[0].cost)} · South
                  sits by the entrance
                </p>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  close();
                  openLandSelect();
                }}
              >
                Survey land on map
              </button>
            </>
          )}
        </div>

        <div className="ledger">
          <h3 className="ledger__title">Today · Day {today.day}</h3>
          <p className="finance__hint" style={{ marginTop: 0 }}>
            Income and running costs accrue through the day into Balance. Purchases
            hit Construction and Balance immediately.
          </p>
          <Row label="Ticket sales" value={today.ticketIncome} kind="in" />
          <Row label="Shops &amp; stalls" value={today.shopIncome} kind="in" />
          <Row label="Donations" value={today.donationIncome} kind="in" />
          <Row
            label="Animal food"
            value={today.animalCosts}
            kind="out"
            hint={`${money(foodDay)}/day`}
          />
          <Row
            label="Staff wages"
            value={today.staffWages}
            kind="out"
            hint={`${money(wageDay)}/day`}
          />
          <Row
            label="Upkeep"
            value={today.upkeep}
            kind="out"
            hint={`${money(upkeepDay)}/day`}
          />
          <Row label="Construction" value={today.capitalSpend} kind="out" />
          <div className="ledger__row ledger__row--net">
            <span className="ledger__label">Net today</span>
            <span
              className="ledger__val"
              style={{ color: net < 0 ? "#e0655a" : "#5fc07a" }}
            >
              {money(net)}
            </span>
          </div>
          <p className="finance__hint">
            Net = income − food − wages − upkeep − construction ({money(income)} −{" "}
            {money(expense)}).
          </p>
        </div>

        {finances.history.length > 0 && (
          <div className="finance__history">
            <h3 className="ledger__title">Recent days</h3>
            <div className="finance__bars">
              {finances.history.slice(-14).map((d) => {
                const dayNet = ledgerNet(d);
                const mag = Math.min(100, Math.abs(dayNet) / 40);
                return (
                  <div key={d.day} className="finance__bar" title={`Day ${d.day}: ${money(dayNet)}`}>
                    <span
                      className={dayNet < 0 ? "finance__bar-fill neg" : "finance__bar-fill pos"}
                      style={{ height: `${Math.max(4, mag)}%` }}
                    />
                    <span className="finance__bar-day">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
