/**
 * Wildhaven — finance modal.
 *
 * A centered overlay (toggled from the top bar's balance chip) that shows the
 * park's books: current balance and conservation points, a ticket-price slider,
 * today's running income / expense ledger, and a short history of settled days.
 */

import {
  ledgerExpense,
  ledgerIncome,
  ledgerNet,
  TICKET_PRICE_RANGE,
} from "../game/economy";
import { useGameStore } from "../store/gameStore";
import { useUIStore } from "../store/uiStore";

/** Signed currency, e.g. -$1,240. */
function money(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString()}`;
}

function Row({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind?: "in" | "out";
}) {
  const sign = kind === "out" ? -1 : 1;
  return (
    <div className="ledger__row">
      <span className="ledger__label">{label}</span>
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

  const finances = useGameStore((s) => s.finances);
  const setTicketPrice = useGameStore((s) => s.setTicketPrice);

  if (!open) return null;

  const today = finances.today;
  const income = ledgerIncome(today);
  const expense = ledgerExpense(today);
  const net = income - expense;
  const [minPrice, maxPrice] = TICKET_PRICE_RANGE;

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

        <div className="ledger">
          <h3 className="ledger__title">Today · Day {today.day}</h3>
          <Row label="Ticket sales" value={today.ticketIncome} kind="in" />
          <Row label="Shops &amp; stalls" value={today.shopIncome} kind="in" />
          <Row label="Donations" value={today.donationIncome} kind="in" />
          <Row label="Animal food" value={today.animalCosts} kind="out" />
          <Row label="Staff wages" value={today.staffWages} kind="out" />
          <Row label="Upkeep" value={today.upkeep} kind="out" />
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
