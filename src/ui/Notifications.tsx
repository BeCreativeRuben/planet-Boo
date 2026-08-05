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
  // whenever welfare, finances, deaths or staffing change.
  const animals = useGameStore((s) => s.animals);
  const finances = useGameStore((s) => s.finances);
  const stats = useGameStore((s) => s.stats);
  const deathNotices = useGameStore((s) => s.deathNotices);
  const staff = useGameStore((s) => s.staff);
  const dismissDeathNotice = useGameStore((s) => s.dismissDeathNotice);

  const dismissed = useUIStore((s) => s.dismissed);
  const dismiss = useUIStore((s) => s.dismissNotification);

  const items = useMemo(
    () => deriveNotifications().filter((n) => !dismissed.includes(n.id)),
    [animals, finances, stats, deathNotices, staff, dismissed],
  );

  if (items.length === 0) return null;

  const onDismiss = (id: string) => {
    dismiss(id);
    if (id.startsWith("death-")) dismissDeathNotice(id);
  };

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
            onClick={() => onDismiss(n.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
