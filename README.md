# Badminton Mixed Doubles — Rotation Visualizer

3D browser app that visualizes badminton mixed doubles rotation patterns. Built to help players understand attack/defense formations and court movement through interactive simulation.

## Features

- **3D court** with real BWF dimensions, singles + doubles lines, net with posts
- **Detailed player models** — visible face direction, articulated arms/legs, rackets, team colors
- **Dynamic rotation engine** — rule-based rally generation (not scripted), implements real badminton rotation principles:
  - Follow the shuttle (drop → hitter follows forward, partner rotates back)
  - Lift/clear → immediate defense (side by side)
  - Smash → stay in attack (front/back)
  - Net shot → maintain pressure, force opponent to lift
  - Front player lateral shift to mirror back player's attack side
- **4 serve types** — short (👇), flick (👆), high (☝️), drive (👉)
- **Serve-specific formations** — short serve → attack, flick/high → defense
- **Reach zone visualization** — toggle on/off to see each player's direct reach and impulse lunge range
- **Playback speed** — 0.1x to 3.0x
- **Player setup** — custom names, left/right-handed option per player
- **Orbit camera** — click & drag to rotate, scroll to zoom

## How to Run

Just open `index.html` in a browser. No install, no build step.

```
open index.html
```

Or use any local file server.

## Tech Stack

- Single HTML file (~2000 lines)
- [Three.js](https://threejs.org/) r0.160.0 (loaded via CDN)
- No framework, no bundler, no dependencies

## Rotation Rules Reference

Based on standard mixed doubles rotation principles:

| Situation | Hitting Team | Receiving Team |
|-----------|-------------|----------------|
| Smash from back | Attack (hitter stays back) | Defense (side by side) |
| Drop from back | Attack (hitter follows forward → becomes front) | Defense |
| Net shot | Attack (hitter stays front) | Depends on response |
| Lift / Clear | Defense (side by side) | Attack (front/back) |
| Short serve | Attack (server stays front) | Defense |
| Flick / High serve | Defense (conceded attack) | Attack |

## Live Demo

https://alexey-bass.github.io/badminton-rotation/

## License

MIT
