# Badminton Mixed Doubles — Rotation Visualizer

## Rules
- Always update this CLAUDE.md when something is added or changed in the project.
- Always update README.md with relevant user-facing changes.
- Before committing, always verify both CLAUDE.md and README.md are up to date with the changes.

## Reference Docs
Badminton doubles training guides used as source of truth for simulation rules:
- `1-TACTICS.md` — strategy, tempo control, targeting, communication
- `2-FORMATIONS.md` — attack/defense formations, rotation rules, follow-the-shuttle
- `3-FOOTWORK.md` — split step, lunge, shuffle, scissor kick, base positions
- `4-SERVES.md` — 4 serve types, hand signals, return positioning
- `5-HITS.md` — all shot types, priorities, deception

## What This Is
A single-file browser app (`index.html`) that visualizes badminton mixed doubles rotation patterns in 3D. Built to help players understand attack/defense formations and court movement.

## Tech Stack
- **Single HTML file** — no build step, no dependencies to install, just open in browser
- **Three.js r0.160.0** — loaded via importmap from unpkg CDN
- **OrbitControls** — from Three.js addons (same CDN)
- No framework, no bundler, no package.json

## Architecture

### Files
- **`index.html`** — main app (CSS + HTML + game logic)
- **`player.js`** — shared ES module with `Player` class, `PLAYER_H`, `RACKET_LEN` exports
- **`physics.html`** — animation debug/tuning page (imports `player.js`)

Both HTML files import `player.js` via ES module. **Requires HTTP server** (not `file://`) due to CORS restrictions on module imports. GitHub Pages works fine.

### player.js — Shared Player Module
`initPlayerModule(THREE)` must be called before creating players. Constructor: `new Player(scene, name, gender, team, handedness, options)`.

Options (dependency injection):
- `getShuttlecock`: `() => shuttlecock` — for head tracking (index.html only)
- `getCamera`: `() => camera` — for label projection (index.html only)
- `getReachVisible` / `getReachOpacity`: for reach zones (index.html only)
- `onLabelCreated`: `(div) => void` — callback when label div created
- `idleFacing`: `'net'` (default, faces net) or `'forward'` (physics.html)
- `swingSpeed`: swing phase multiplier (default 5, tunable in physics.html)
- `jumpHeights`: `{ smash, overhead, netHop }` — tunable jump heights

### Key Classes
- **`Player`** (in player.js) — Detailed 3D humanoid model with visible face (eyes, nose, mouth, ears), hair (short for male, ponytail for female), articulated arms (shoulder, upper arm, elbow, forearm, hand), articulated legs (thigh, knee, shin, ankle, shoe with team-colored stripe), two-part torso (chest + waist), neck. Movement interpolation, swing animations, floating name label. Properties: name, gender, team (A/B), handedness (left/right), role (front/back)
- **`Shuttlecock`** — cork+feather model with glow, cubic bezier trajectory (4-point, guarantees net clearance), trail effect
- **`RallyEngine`** — orchestrates rallies dynamically using rule-based rotation engine, manages serve flow and formation transitions

### Dynamic Rally Engine (rule-based, no hardcoded patterns)
Rallies are generated dynamically shot-by-shot using real badminton rotation rules.

**Shot types** (all from 5-HITS.md reference):
- Smash variants: `smash`, `smash_half`, `smash_stick`, `smash_jump`, `smash_slice`
- Drop variants: `drop`, `drop_fast`, `drop_slow`
- Drive variants: `drive`, `drive_flat`, `drive_offensive`, `drive_defensive`
- Net: `net`, `net_kill`, `push`
- Block: `block`, `block_cross`
- Others: `clear`, `lift`

**Shot selection** (`_chooseShot`): Based on role, formation, and context per reference docs:
- **Back in attack**: smash (55-60%), fast drop (12%), half-smash (10%), slow drop (8%), clear (5%). Tempo variation: if 3+ recent smashes → more drops/half-smash.
- **Front in attack**: net kill (20%), net shot (35%), push (17%), drive (13%), lift (15% last resort).
- **Defense**: block/block_cross (30%), drive (25%), push (10%), lift (35%).
- **Serve return** (rallyLength===1): special logic per serve type from 4-SERVES golden rule ("don't lift unless forced"). Short serve → net kill/net/push. Flick → smash/drop. Drive → block/counter-drive.
- **Diagonal/transition**: drive (35%), push (20%), block/net (20%), lift (25%).

**Target computation** (`_computeTarget`): Targets opponent gaps, body, or court sides:
- Smash: 45% straight, 20% body (closer opponent), 20% gap (between opponents), 15% cross-court
- Net/push: 40% cross-net, 35% straight, 25% tight center
- Block_cross targets opposite side from hitter

**Rotation rules** (`_applyRotationRules`): Applied BEFORE positioning per 2-FORMATIONS:
- **Smash**: hitter stays back, partner stays front → attack maintained
- **Drop (FOLLOW THE SHUTTLE)**: hitter follows forward → becomes front, partner rotates back
- **Block (DEFENSE→ATTACK)**: blocker moves forward to front → key transition mechanism
- **Net/push/net_kill**: hitter stays front, partner covers back → attack maintained
- **Lift/Clear (CONCEDE ATTACK)**: → immediate side-by-side defense
- **Drive**: → diagonal transitional formation (one slightly forward, one behind, opposite sides)

**Formation positioning** (`_positionTeam`) per 2-FORMATIONS:
- **Attack**: front at service line (~1.98m), shifted to SAME side as attack. Back at ~5.2m, slightly biased toward attack side.
- **Defense**: side-by-side at ~3.5m (one step behind mid-court), both shift laterally toward attack side.
- **Diagonal**: one player slightly forward on one side, other slightly behind on opposite side.

**Serve positioning** per 4-SERVES:
- Server at service line. Partner 2 racket lengths (~1.34m) behind.
- Receiver close to service line (0.3m behind). Receiver's partner at mid-court (~3.5m).

**Reaction delay**: Receiving team doesn't move instantly — delay varies by shot speed:
- Smash: 0.12s, Drive: 0.15s, Drop: 0.20s, Net: 0.18s, Clear: 0.30s, Lift: 0.28s
- Hitting team positions immediately (they know their own shot)
- Implemented via `_reactionTimer` + `_pendingRecvTeam` queued in `_applyFormations`, applied in `update()`

**Head tracking**: All players' heads follow the shuttlecock position each frame (yaw ±0.8 rad, pitch clamped). Smoothly returns to neutral when shuttle inactive.

**Body orientation rules**:
- When moving, body always faces the net (not the movement direction). This matches real badminton footwork — players shuffle sideways/backwards while keeping eyes and body oriented toward the net.
- Head independently tracks the shuttlecock regardless of body direction.

**Footwork state machine** (`footworkState` in Player): 4 states with automatic transitions:
- **`ready`**: Athletic crouch — knees bent 0.25 rad, weight on balls of feet, subtle bounce (sin wave). Triggered when idle (not moving, not lunging/split stepping).
- **`splitStep`**: Small hop (0.06m) triggered automatically when transitioning from idle to moving. Both legs splay outward, knees bend on landing. Duration ~0.17s (phase speed dt*6). Transitions to `moving` when complete.
- **`moving`**: Badminton shuffle — faster cadence (dt*12), shorter quicker steps than jogging. Hip swing 0.35 rad, knee lift 0.55 rad. Arms pump lightly. Leg Z-rotation reset (from split step splay).
- **`lunging`**: Deep forward step triggered when swinging net/drop/lift/drive/serve_short shots (not overhead). Front leg: -0.9 hip + 1.2 knee bend. Back leg: +0.6 hip + 0.15 knee (nearly straight). Body (torso) leans forward 0.15 rad. Free arm extends back for balance. Duration ~0.33s (phase speed dt*3). Smooth in-out curve (accelerate → hold → recover).

**Transitions**: `ready` → (starts moving) → `splitStep` → `moving` → (stops) → `ready`. Lunge triggered independently by `startSwing()` for applicable shot types. Torso lean recovers smoothly (×0.85 decay) when not lunging.

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
- **3D scene**: light gray-blue sky (`0xe8ecf1`), warm wood-tone gym floor (`0xc8b99a`), gray court surface (`0x8a8a8a`), bright lighting (exposure 1.6)
- **UI overlays**: white/translucent backgrounds, dark text, subtle borders and box-shadows
- **Accent colors**: amber/warm (`#b45309`, `#d97706`) for highlights, dark blue (`#1d4ed8`) for Team A, dark red (`#b91c1c`) for Team B
- **Player labels**: white background with team-colored text and subtle shadow

## Reach Zones
Each player has two floor-projected circles showing their coverage area:
- **Direct reach**: asymmetric egg shape — wider on racket side (~1.2m), shorter on backhand (~0.7m)
- **Impulse reach**: asymmetric — racket side ~3.2m, backhand ~2.2m
- **Gradient coloring**: green (center, easy reach) → yellow → orange → red → dark red (edges, hardest to reach). Uses vertex-colored `BufferGeometry` with 12 concentric rings × 48 angular segments for smooth interpolation.
- Zones rotate with player facing direction, racket side determined by handedness
- Toggle on/off via checkbox in bottom controls bar
- Opacity slider (0.05–0.5) to adjust visibility; impulse zone is at 60% of the set opacity

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

Name pools: males (Aleks, Tomasz, Jakub, Mateusz, Piotr, Bartek, Kamil, Dawid, Marcin, Wojtek), females (Ola, Kasia, Ania, Magda, Zuzia, Monika, Patrycja, Ewa, Agnieszka, Joanna).

## How to Run
```
open index.html
```
Or any local file server. No install needed.
