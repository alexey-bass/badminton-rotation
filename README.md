# Badminton Mixed Doubles — Rotation Visualizer

3D browser app that visualizes badminton mixed doubles rotation patterns. Built to help players understand attack/defense formations and court movement through interactive simulation.

## Features

- **3D court** with real BWF dimensions, singles + doubles lines, net with posts
- **Detailed player models** — visible face direction, articulated arms/legs, rackets, team colors
- **Players track the shuttlecock** — all heads follow the bird in flight, racket aims at contact point
- **Realistic footwork** — split step on movement start, badminton shuffle (body always faces net), lunges for net/drop shots, athletic ready stance
- **Realistic reaction delays** — receiving team reacts slower to smashes (0.12s) vs clears (0.30s)
- **20+ shot types** — smash (full, half, stick, jump, slice), drops (fast, slow), drives (flat, offensive, defensive), net kill, push, block, clear, lift
- **Dynamic rotation engine** — rule-based per reference docs, implements real doubles rotation:
  - Follow the shuttle (drop → hitter follows forward, partner rotates back)
  - Block → attack transition (blocker moves to front)
  - Lift/clear → immediate defense (side by side)
  - Drive → diagonal transitional formation
  - Serve return golden rule (don't lift unless forced)
  - Tempo variation (shot history tracking)
  - Targeting: opponent body, gaps between players, court sides
- **4 serve types** — short (👇), flick (👆), high (☝️), drive (👉)
- **Serve-specific formations** — short serve → attack, flick/high → defense
- **Reach zone visualization** — asymmetric zones (wider on racket side), green-to-red gradient showing easy vs hard-to-reach areas
- **Playback speed** — 0.1x to 3.0x
- **Player setup** — custom names, left/right-handed option per player
- **Orbit camera** — click & drag to rotate, scroll to zoom

## How to Run

Requires a local HTTP server (ES modules don't load from `file://`):

```
python3 -m http.server 8080
# then open http://localhost:8080
```

Or just use the [live demo](https://alexey-bass.github.io/badminton-rotation/).

## Tech Stack

- `index.html` — main app
- `player.js` — shared Player module (ES module, imported by both pages)
- `physics.html` — animation debug/tuning page
- [Three.js](https://threejs.org/) r0.160.0 (loaded via CDN)
- No framework, no bundler, no npm dependencies

## Rotation Rules Reference

Based on standard mixed doubles rotation principles:

| Situation | Hitting Team | Receiving Team |
|-----------|-------------|----------------|
| Smash from back | Attack (hitter stays back) | Defense (side by side) |
| Drop from back | Attack (hitter follows forward → becomes front) | Defense |
| Block from defense | Attack (blocker moves to front) | Under pressure |
| Net shot / Push | Attack (hitter stays front) | Depends on response |
| Drive | Diagonal (transitional) | Diagonal |
| Lift / Clear | Defense (side by side) | Attack (front/back) |
| Short serve | Attack (server stays front) | Defense |
| Flick / High serve | Defense (conceded attack) | Attack |

## Live Demo

https://alexey-bass.github.io/badminton-rotation/

## Author

[Alexey Bass](https://www.linkedin.com/in/alexeybass/)

## License

MIT &copy; 2026 Alexey Bass
