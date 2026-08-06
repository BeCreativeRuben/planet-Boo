/**
 * Wildhaven — inspector shell.
 *
 * Shared frame for entity inspectors: glass panel, optional compact layout when
 * a build tab is open, and the Escape keyboard hint.
 */

import type { ReactNode } from "react";

export function inspectorClass(compact?: boolean): string {
  return `inspector glass${compact ? " inspector--compact" : ""}`;
}

export function InspectorFrame({
  compact,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={inspectorClass(compact)}>
      {children}
      <p className="inspector__kbd-hint" aria-hidden>
        <kbd>Esc</kbd> close panels · clear selection
      </p>
    </div>
  );
}
