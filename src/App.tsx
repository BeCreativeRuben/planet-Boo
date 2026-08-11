/**
 * Wildhaven — application shell.
 *
 * Shows the title screen first, then mounts the full-screen 3D park (ZooScene)
 * with the HUD overlay floating on top. The HUD is a fixed, pointer-events:none
 * layer (its panels re-enable pointer events), so clicks fall through to the
 * 3D scene for selection and building.
 */

import { useEffect, useState } from "react";

import TitleScreen from "./ui/TitleScreen";
import HUD from "./ui/HUD";
import { ZooScene } from "./world/ZooScene";
import { seedDemoParkIfEmpty } from "./store/demoSeed";
import { loadGame, saveGame } from "./store/gameStore";
import { useUIStore } from "./store/uiStore";

export default function App() {
  const [started, setStarted] = useState(false);

  /** Fresh empty park (entrance + parking + path). */
  const start = () => {
    setStarted(true);
    // Defer so HUD mounts before the tutorial card opens.
    queueMicrotask(() => useUIStore.getState().maybeOpenTutorial());
  };

  /** Hand-authored demo park for touring systems. */
  const startDemo = () => {
    seedDemoParkIfEmpty();
    setStarted(true);
  };

  const resume = () => {
    loadGame();
    setStarted(true);
  };

  // Autosave every 20s while playing.
  useEffect(() => {
    if (!started) return;
    saveGame();
    const id = window.setInterval(() => saveGame(), 20_000);
    return () => window.clearInterval(id);
  }, [started]);

  if (!started) {
    return (
      <TitleScreen onStart={start} onDemo={startDemo} onContinue={resume} />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <ZooScene />
      </div>
      <HUD />
    </div>
  );
}
