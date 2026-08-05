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

export default function App() {
  const [started, setStarted] = useState(false);

  const start = () => {
    // Populate an empty park with a small demo so both the 3D scene and HUD
    // have something to show immediately (no-op once the player has built).
    seedDemoParkIfEmpty();
    setStarted(true);
  };

  const resume = () => {
    if (!loadGame()) seedDemoParkIfEmpty();
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
    return <TitleScreen onStart={start} onContinue={resume} />;
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
