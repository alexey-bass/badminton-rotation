# Badminton Mixed Doubles — Rotation Visualizer

## Rules
- Always update this CLAUDE.md when something is added or changed in the project.

## What This Is
A single-file browser app (`index.html`) that visualizes badminton mixed doubles rotation patterns in 3D. Built to help players understand attack/defense formations and court movement.

## Tech Stack
- **Single HTML file** — no build step, no dependencies to install, just open in browser
- **Three.js r0.160.0** — loaded via importmap from unpkg CDN
- **OrbitControls** — from Three.js addons (same CDN)
- No framework, no bundler, no package.json

## Architecture (all in index.html)

### Sections (top to bottom)
1. **CSS** — UI overlay styles (top bar, panels, controls, formation banner)
2. **HTML** — UI elements (formation banner, shot info, team panels, controls, legend)
3. **JS module** — all logic in a single `<script type="module">`

### Key Classes
- **`Player`** — Detailed 3D humanoid model with visible face (eyes, nose, mouth, ears), hair (short for male, ponytail for female), articulated arms (shoulder, upper arm, elbow, forearm, hand), articulated legs (thigh, knee, shin, ankle, shoe with team-colored stripe), two-part torso (chest + waist), neck. Movement interpolation, swing animations, floating name label. Properties: name, gender, team (A/B), handedness (left/right), role (front/back)
- **`Shuttlecock`** — cork+feather model with glow, cubic bezier trajectory (4-point, guarantees net clearance), trail effect
- **`RallyEngine`** — orchestrates rallies. Generates shot sequences from 6 choreographed patterns, moves players, triggers swings, updates formation display
- **`FormationIndicator`** — colored circles on court showing attack (front/back zones) or defense (side/side zones)

### Dynamic Rally Engine (rule-based, no hardcoded patterns)
Rallies are generated dynamically shot-by-shot using real badminton rotation rules.

**Shot selection** (`_chooseShot`): Based on player's role (front/back) and team formation:
- Back player in attack: smash (40%), drop (35%), clear (25%)
- Front player in attack: net shot (80%), lift (20%)
- Defense: lift (40%), block to net (25%), drive (35%)

**Target computation** (`_computeTarget`): Each shot type has realistic landing zones with randomized X variation for variety.

**Rotation rules** (`_applyRotationRules`): Applied BEFORE positioning players each shot:
- **Smash**: hitter stays back, partner stays front → attack maintained
- **Drop (FOLLOW THE SHUTTLE)**: hitter follows drop forward → becomes front player, partner rotates back. This is the key rotation mechanic.
- **Net shot**: hitter stays front, partner covers back → attack maintained
- **Lift/Clear (CONCEDE ATTACK)**: hitting team → immediate defense (side by side). Receiving team → attack.
- **Drive**: neutral, keep current formation.

**Formation positioning** (`_applyFormations`):
- **Attack (front/back)**: front player at ~2.2m from net, shifted laterally toward shuttle side (mirrors attack). Back player at ~5.2m.
- **Defense (side/side)**: both players at ~4m depth, split left (-1.2) / right (+1.2).
- Receiver always moves toward shuttle landing spot.

**Serve-specific formations**:
- Short serve → server stays front, partner covers back (attack)
- Flick/high/drive serve → serving team goes to defense (conceded attack)

### Serve System
Every rally starts with a serve. The flow is: `generateRally()` → players move to positions → **pause for user input** → user picks serve type → rally plays out.

**States**: `idle` → `moving_to_serve` → `waiting_serve` (paused, overlay shown) → `rally` → `between` → repeat

**Serve panel** (`#serve-overlay`): positioned on the right side (not blocking court view), appears when players are in position, shows two buttons stacked vertically:
- **Short Serve** (👇 finger down): low arc, lands just past the service line (`serve_short`)
- **Flick Serve** (👆 finger up): deceptive quick snap to back court (`serve_flick`)
- **High Serve** (☝️ finger point up): very high arc, lands deep at back (`serve_high`)
- **Drive Serve** (👉 finger right): flat and fast to mid-court (`serve_drive`)

**Serve rules**:
- Serving team alternates based on total score (even = Team A, odd = Team B)
- Server stands in right service box when their score is even, left when odd
- Shuttle goes diagonally to opponent's opposite service box
- Hit height is 1.1m (below waist, per BWF rules)
- Right service court: `-X` for Team A, `+X` for Team B (matches visual on-screen right from default camera)
- Racket arm: `side=-1` for right-handed, `side=+1` for left-handed (flipped from anatomical to match visual expectation)
- Player ground offset calculated per body scale so feet sit on court surface (not floating)

### Shuttlecock Trajectory
Uses cubic bezier with two control points (cp1 on hitter's side, cp2 on receiver's side). Both control points are placed above `NET_H + 0.25m` to guarantee the shuttle always clears the net.

## Court Dimensions (real BWF spec)
- Full length: 13.4m (Z axis, -6.7 to +6.7)
- Doubles width: 6.1m (X axis, -3.05 to +3.05)
- Net at Z=0, height 1.55m
- Service line: 1.98m from net
- Back service line: 0.76m from back boundary
- Singles sidelines: 0.46m inside doubles sidelines (DOUBLES_SIDE constant)
- Team A plays Z < 0 (near side, blue), Team B plays Z > 0 (far side, red)

## Formation Logic
- **Attack (front/back)**: one player at ~Z=±2 (front, usually female in mixed), one at ~Z=±5 (back, usually male). Used when team is hitting downward or at net.
- **Defense (side/side)**: both players at ~Z=±4, split left/right (X=±1.2). Used when receiving smashes or drives.
- **Transition**: moving between formations after a shot changes the rally dynamic.

## Theme
Light theme throughout:
- **3D scene**: light gray-blue sky (`0xe8ecf1`), warm wood-tone gym floor (`0xc8b99a`), bright lighting (exposure 1.6)
- **UI overlays**: white/translucent backgrounds, dark text, subtle borders and box-shadows
- **Accent colors**: amber/warm (`#b45309`, `#d97706`) for highlights, dark blue (`#1d4ed8`) for Team A, dark red (`#b91c1c`) for Team B
- **Player labels**: white background with team-colored text and subtle shadow

## Reach Zones
Each player has two floor-projected circles showing their coverage area:
- **Direct reach** (solid team color, ~1.0m radius): area reachable by arm+racket without moving feet
- **Impulse reach** (lighter team color, ~2.8m radius): area reachable with one lunge step
- Toggle on/off via checkbox in bottom controls bar
- Opacity slider (0.05–0.5) to adjust visibility; impulse zone is at 60% of the set opacity
- Zones follow player position each frame; rendered as flat circles on the court surface (`depthWrite: false`)

## UI Controls
- Play/Pause button
- New Rally button (resets score and starts fresh)
- Speed slider: 0.1x to 3.0x
- Reach zones: on/off checkbox + opacity slider
- Orbit camera: click+drag to rotate, scroll to zoom

## Setup Screen
Before the game starts, a setup screen (`#setup-screen`) is shown with:
- 4 player rows (Team A male/female, Team B male/female)
- Name input fields (pre-filled with random names from pools)
- Left-handed checkbox for each player (default: all right-handed)
- Playback speed slider (0.1x–3.0x, default 1.0x) — syncs to the in-game speed control on start
- "Start Game" button — creates players with chosen settings, hides setup, begins simulation

Name pools: males (Alex, Viktor, Chen Wei, Hendra, Marcus, Kevin, Anders, Lee Zii, Takeshi, Fajar), females (Lisa, Nozomi, Carolina, Tai Tzu, Greysia, Yuki, Chen Qing, Mayu, Apriyani, Saina).

## How to Run
```
open index.html
```
Or any local file server. No install needed.
