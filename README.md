# Wildhaven

A browser-based **Planet Zoo**-inspired zoo management game. Build habitats, care for animals, welcome guests, and grow a living sanctuary — all in WebGL.

![Wildhaven](public/assets/wildhaven-hero.svg)

## Play

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **Open the Gates**.

Deep-link straight into the park: `http://localhost:5173/#play`

## Features

- **16 species** across savanna, forest, wetland, desert, arctic, and mountain biomes
- **Habitat welfare** — biome, temperature, humidity, space, social needs, enrichment, hunger, health
- **Build tools** — fences, gates, paths, enrichment, guest amenities, staff facilities
- **Guests & economy** — ticket sales, shops, staff wages, daily settlement, conservation points
- **Day / night** — ~15-minute cycles; daytime visitors, nighttime maintenance (speed up to skip)
- **Land parcels** — buy adjacent plots in any direction; parking lot capacity gates arrivals
- **3D park** — orbit camera, day cycle, low-poly animals, walking guests
- **Demo park** — opens with starter habitats so you can explore immediately

## Controls

| Input | Action |
|-------|--------|
| Left drag | Orbit camera |
| Right drag / middle | Pan |
| Scroll | Zoom |
| Click terrain (build mode) | Place selected item |
| Click animal / building | Inspect |
| HUD toolbar | Habitat · Scenery · Guest · Staff · Animals |
| Space / pause button | Pause simulation |
| 1× 2× 3× | Simulation speed |

## Stack

Vite · React 19 · TypeScript · Three.js · React Three Fiber · Zustand

## Project layout

```
src/game/     Species, buildings, welfare, economy, simulation
src/store/    Zustand game + UI stores, demo seed
src/world/    R3F scene, terrain, animals, guests, buildings
src/ui/       Title screen, HUD, panels
public/assets Hero and habitat art
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Oxlint |
