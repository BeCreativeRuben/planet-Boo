/**
 * Wildhaven — Title screen.
 *
 * Full-bleed golden-hour hero. First viewport is intentionally sparse: brand,
 * one headline sentence, and a single CTA. A quiet "Continue" appears only when
 * a save exists in localStorage. Motion: a slow ken-burns drift on the photo
 * and staggered fade-ups on the text.
 */

import { useEffect, useState } from "react";
import { saveExists } from "../store/gameStore";

const HERO_SRC = "/assets/wildhaven-hero.svg";

interface TitleScreenProps {
  /** Begin a fresh park. */
  onStart: () => void;
  /** Resume from a save; falls back to onStart when omitted. */
  onContinue?: () => void;
}

export default function TitleScreen({ onStart, onContinue }: TitleScreenProps) {
  const [hasSave, setHasSave] = useState(false);

  // Read the save flag on mount (avoids SSR / hydration mismatches).
  useEffect(() => {
    setHasSave(saveExists());
    // Deep-link straight into the park with #play (handy for sharing / testing).
    if (window.location.hash === "#play") onStart();
  }, [onStart]);

  return (
    <main className="title">
      <div
        className="title__bg"
        style={{ backgroundImage: `url(${HERO_SRC})` }}
        role="img"
        aria-label="A golden-hour view over the Wildhaven safari park"
      />
      <div className="title__scrim" aria-hidden />
      <div className="title__bloom" aria-hidden />

      <header className="title__top">
        <span className="title__mark" aria-hidden>
          🌿
        </span>
        <span className="title__wordmark">Wildhaven</span>
      </header>

      <section className="title__hero">
        <p className="title__eyebrow">A living-world zoo builder</p>

        <h1 className="title__brand">
          Wild<em>haven</em>
        </h1>

        <p className="title__tagline">
          Raise a sanctuary where every creature thrives — and every guest
          leaves wide-eyed.
        </p>

        <div className="title__actions">
          <button
            type="button"
            className="btn btn--amber title__cta"
            onClick={onStart}
            autoFocus
          >
            Open the Gates <span className="arrow">→</span>
          </button>

          {hasSave && (
            <button
              type="button"
              className="title__continue"
              onClick={onContinue ?? onStart}
            >
              Continue your park
            </button>
          )}
        </div>
      </section>

      <footer className="title__foot">
        <span className="title__foot-mark">Wildhaven</span>
        <span className="title__foot-dot" aria-hidden>
          ·
        </span>
        <span>Build · Nurture · Conserve</span>
      </footer>
    </main>
  );
}
