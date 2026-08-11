/**
 * Wildhaven — skippable first-run tutorial.
 *
 * Compact card over the empty park. Next / Back / Skip — Escape also skips.
 */

import { useUIStore } from "../store/uiStore";
import { TUTORIAL_STEPS } from "../game/tutorial";

export default function TutorialPanel() {
  const open = useUIStore((s) => s.tutorialOpen);
  const stepIndex = useUIStore((s) => s.tutorialStep);
  const next = useUIStore((s) => s.nextTutorialStep);
  const prev = useUIStore((s) => s.prevTutorialStep);
  const skip = useUIStore((s) => s.skipTutorial);

  if (!open) return null;

  const step = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0]!;
  const last = stepIndex >= TUTORIAL_STEPS.length - 1;
  const first = stepIndex <= 0;

  return (
    <div className="tutorial" role="dialog" aria-modal="true" aria-label="Quick start">
      <div className="tutorial__card glass">
        <header className="tutorial__head">
          <p className="tutorial__eyebrow">
            Quick start · {stepIndex + 1} / {TUTORIAL_STEPS.length}
          </p>
          <button type="button" className="tutorial__skip" onClick={skip}>
            Skip
          </button>
        </header>

        <h2 className="tutorial__title">{step.title}</h2>
        <p className="tutorial__body">{step.body}</p>
        {step.hint ? <p className="tutorial__hint">{step.hint}</p> : null}

        <div className="tutorial__nav">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={prev}
            disabled={first}
          >
            Back
          </button>
          <button type="button" className="btn btn--amber" onClick={next} autoFocus>
            {last ? "Let's build" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
