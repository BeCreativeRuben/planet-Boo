/**
 * Wildhaven — toast notifications.
 *
 * A stack of dismissible toasts in the top-right of the HUD. The messages
 * themselves are *derived* from live game state (unhappy animals, bankruptcy
 * warnings, rating milestones) in {@link deriveNotifications}; this component
 * only presents them and remembers which ones the player has dismissed.
 */

import { useMemo } from "react";

import { deriveNotifications } from "../store/selectors";
import { useGameStore } from "../store/gameStore";
import { useUIStore, type NotificationKind } from "../store/uiStore";

const ICON: Record<NotificationKind, string> = {
  critical: "⛔",
  warning: "⚠️",
  success: "🎉",
  info: "ℹ️",
};

export default function Notifications() {
  // Subscribe to the slices the derivation depends on so the toasts refresh
  // whenever welfare, finances or the rating change (deriveNotifications reads
  // the live store; these subscriptions drive the re-render + memo below).
  const animals = useGameStore((s) => s.animals);
  const finances = useGameStore((s) => s.finances);
  const stats = useGameStore((s) => s.stats);

  const dismissed = useUIStore((s) => s.dismissed);
  const dismiss = useUIStore((s) => s.dismissNotification);

  const items = useMemo(
    () => deriveNotifications().filter((n) => !dismissed.includes(n.id)),
    [animals, finances, stats, dismissed],
  );

  if (items.length === 0) return null;

  return (
    <div className="notifs" role="log" aria-live="polite">
      {items.map((n) => (
        <div key={n.id} className={`notif notif--${n.kind} glass`}>
          <span className="notif__icon" aria-hidden>
            {ICON[n.kind]}
          </span>
          <div className="notif__body">
            <strong className="notif__title">{n.title}</strong>
            {n.message && <p className="notif__msg">{n.message}</p>}
          </div>
          <button
            type="button"
            className="notif__close"
            aria-label="Dismiss"
            onClick={() => dismiss(n.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
