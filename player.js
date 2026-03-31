// player.js — Shared Player module for badminton rotation visualizer
// Imported by both index.html and physics.html

let THREE;

export const PLAYER_H = 1.75;
export const RACKET_LEN = 0.67;

export function initPlayerModule(_THREE) {
  THREE = _THREE;
}

export class Player {
  /**
   * @param {THREE.Scene} scene
   * @param {string} name
   * @param {string} gender - 'male' | 'female'
   * @param {string} team - 'A' | 'B'
   * @param {string} handedness - 'right' | 'left'
   * @param {object} options
   * @param {function} [options.getShuttlecock] - () => shuttlecock object (for head tracking)
   * @param {function} [options.getCamera] - () => camera (for label projection)
   * @param {function} [options.getReachVisible] - () => boolean
   * @param {function} [options.getReachOpacity] - () => number
   * @param {function} [options.onLabelCreated] - (div) => void
   * @param {string}   [options.idleFacing] - 'net' (default) | 'forward'
   * @param {number}   [options.swingSpeed] - swing phase multiplier (default 5)
   * @param {object}   [options.jumpHeights] - { smash, overhead, netHop }
   */
  constructor(scene, name, gender, team, handedness, options = {}) {
    this.scene = scene;
    this.name = name;
    this.gender = gender;
    this.team = team;
    this.handedness = handedness;
    this.role = 'back';

    this.position = new THREE.Vector3(0, 0, 0);
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.swingPhase = -1;
    this.swingType = 'clear';
    this.jumpPhase = -1;
    this.jumpHeight = 0;
    this.jumpDuration = 0.5;
    this.facingAngle = 0;
    this.targetFacingAngle = 0;
    this.walkCycle = 0;
    this.isMoving = false;

    // Footwork state machine
    this.footworkState = 'ready'; // ready, splitStep, moving, lunging
    this.splitStepPhase = -1;     // 0..1 for split step hop
    this.lungePhase = -1;         // 0..1 for lunge animation
    this.lungeSide = 1;           // 1=right foot forward, -1=left
    this._prevMoving = false;     // track state transitions

    // Tunable options
    this._getShuttlecock = options.getShuttlecock || null;
    this._getCamera = options.getCamera || null;
    this._getReachVisible = options.getReachVisible || null;
    this._getReachOpacity = options.getReachOpacity || null;
    this._onLabelCreated = options.onLabelCreated || null;
    this._idleFacing = options.idleFacing || 'net';
    this.swingSpeed = options.swingSpeed ?? 5;
    this.jumpHeights = options.jumpHeights ?? { smash: 0.35, overhead: 0.25, netHop: 0.12 };

    this.group = new THREE.Group();
    this.bodyParts = {};
    this._buildModel();
    scene.add(this.group);

    if (this._getReachVisible) this._createReachZones();
    if (this._getCamera) this._createLabel();
  }

  _color() {
    if (this.team === 'A') {
      return this.gender === 'male' ? 0x2563eb : 0x60a5fa;
    }
    return this.gender === 'male' ? 0xdc2626 : 0xf87171;
  }

  _buildModel() {
    const col = this._color();
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xc4756e, roughness: 0.5 });
    const hairColor = this.gender === 'male' ? 0x1a1a1a : 0x3d1c02;
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.5 });

    const s = this.gender === 'male' ? 1.0 : 0.88;
    this.bodyScale = s;

    const headY = PLAYER_H * s;
    const neckY = headY - 0.2;
    const shoulderY = neckY - 0.05;
    const hipY = shoulderY - 0.4;
    const kneeY = hipY - 0.38;
    const ankleY = kneeY - 0.35;
    const footY = ankleY - 0.04;

    this.groundOffset = -footY;

    // ---- HEAD ----
    const headGroup = new THREE.Group();
    headGroup.position.y = headY;

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 16, 16), skinMat);
    skull.scale.set(1, 1.1, 0.95);
    skull.castShadow = true;
    headGroup.add(skull);

    for (let ex of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 8, 8), eyeWhiteMat);
      eyeWhite.position.set(ex * 0.045 * s, 0.015 * s, 0.11 * s);
      eyeWhite.scale.set(1, 0.7, 0.5);
      headGroup.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 6, 6), eyeMat);
      pupil.position.set(ex * 0.045 * s, 0.015 * s, 0.125 * s);
      pupil.scale.set(1, 0.8, 0.5);
      headGroup.add(pupil);
    }

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018 * s, 6, 6), skinMat);
    nose.position.set(0, -0.01 * s, 0.125 * s);
    nose.scale.set(0.7, 0.6, 0.8);
    headGroup.add(nose);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.008 * s, 0.01 * s), mouthMat);
    mouth.position.set(0, -0.04 * s, 0.12 * s);
    headGroup.add(mouth);

    for (let ex of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025 * s, 6, 6), skinMat);
      ear.position.set(ex * 0.12 * s, -0.01 * s, 0);
      ear.scale.set(0.4, 0.7, 0.6);
      headGroup.add(ear);
    }

    // Hair: hemisphere (top half of sphere) tilted backward around X axis
    // This naturally exposes the forehead while covering crown + back
    // Skull radius = 0.13*s, hair just slightly larger to sit on top
    if (this.gender === 'male') {
      // Short hair: hemisphere tilted back ~20°
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.135 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), hairMat);
      hair.rotation.x = -0.35; // tilt back: front edge rises, back dips
      headGroup.add(hair);
    } else {
      // Female: slightly more coverage, tilted back
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.138 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
      hair.rotation.x = -0.3;
      headGroup.add(hair);

      // Back hair flowing down behind head
      const hairBack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09 * s, 0.05 * s, 0.14 * s, 8), hairMat);
      hairBack.position.set(0, -0.08 * s, -0.08 * s);
      headGroup.add(hairBack);

      // Ponytail
      const ponytail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03 * s, 0.015 * s, 0.2 * s, 6), hairMat);
      ponytail.position.set(0, -0.18 * s, -0.09 * s);
      ponytail.rotation.x = 0.3;
      headGroup.add(ponytail);
    }

    this.group.add(headGroup);
    this.bodyParts.head = headGroup;

    // ---- NECK ----
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.08 * s, 8), skinMat);
    neck.position.y = neckY;
    this.group.add(neck);

    // ---- TORSO ----
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.14 * s, 0.22 * s, 8), mat);
    chest.position.y = shoulderY - 0.11;
    chest.castShadow = true;
    this.group.add(chest);

    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.11 * s, 0.2 * s, 8), mat);
    waist.position.y = shoulderY - 0.32;
    waist.castShadow = true;
    this.group.add(waist);
    this.bodyParts.torso = chest;

    // ---- SHORTS / SKIRT ----
    if (this.gender === 'female') {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.17 * s, 0.16 * s, 8), mat);
      skirt.position.y = hipY + 0.02;
      this.group.add(skirt);
    } else {
      const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.12 * s, 0.14 * s, 8), darkMat);
      shorts.position.y = hipY + 0.02;
      this.group.add(shorts);
    }

    // ---- LEGS (hip pivot > thigh + knee pivot > shin + shoe) ----
    for (let side of [-1, 1]) {
      const hipPivot = new THREE.Group();
      hipPivot.position.set(side * 0.06 * s, hipY, 0);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.04 * s, 0.38 * s, 8), skinMat);
      thigh.position.y = -0.19 * s;
      thigh.castShadow = true;
      hipPivot.add(thigh);

      const kneePivot = new THREE.Group();
      kneePivot.position.y = -0.38 * s;
      hipPivot.add(kneePivot);

      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 6, 6), skinMat);
      kneePivot.add(kneeJoint);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.035 * s, 0.35 * s, 8), skinMat);
      shin.position.y = -0.18 * s;
      shin.castShadow = true;
      kneePivot.add(shin);

      const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 6, 6), skinMat);
      ankle.position.y = -0.35 * s;
      kneePivot.add(ankle);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.045 * s, 0.14 * s), whiteMat);
      shoe.position.set(0, -0.38 * s, 0.02 * s);
      kneePivot.add(shoe);

      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.072 * s, 0.015 * s, 0.08 * s),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }));
      stripe.position.set(0, -0.37 * s, 0.02 * s);
      kneePivot.add(stripe);

      this.group.add(hipPivot);
      const sideKey = side === -1 ? 'left' : 'right';
      this.bodyParts[sideKey + 'Leg'] = hipPivot;
      this.bodyParts[sideKey + 'Knee'] = kneePivot;
    }

    // ---- ARMS (shoulder pivot > upper arm + elbow pivot > forearm + hand + racket) ----
    for (let side of [-1, 1]) {
      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(side * 0.19 * s, shoulderY - 0.04, 0);

      const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 8, 8), mat);
      shoulderPivot.add(shoulderJoint);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.03 * s, 0.22 * s, 8), skinMat);
      upperArm.position.y = -0.14 * s;
      upperArm.castShadow = true;
      shoulderPivot.add(upperArm);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.y = -0.25 * s;
      shoulderPivot.add(elbowPivot);

      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 6, 6), skinMat);
      elbowPivot.add(elbowJoint);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * s, 0.025 * s, 0.2 * s, 8), skinMat);
      forearm.position.y = -0.11 * s;
      forearm.castShadow = true;
      elbowPivot.add(forearm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 6, 6), skinMat);
      hand.position.y = -0.22 * s;
      elbowPivot.add(hand);

      const isRacketArm = (this.handedness === 'right' && side === -1) ||
                           (this.handedness === 'left' && side === 1);
      const armKey = isRacketArm ? 'racketArm' : 'freeArm';
      this.bodyParts[armKey] = shoulderPivot;
      this.bodyParts[armKey + 'Elbow'] = elbowPivot;

      this.group.add(shoulderPivot);

      if (isRacketArm) {
        const racketGroup = new THREE.Group();
        racketGroup.position.y = -0.22 * s;

        const grip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.011, 0.18, 8),
          new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.3, roughness: 0.6 }));
        grip.position.y = -0.09;
        racketGroup.add(grip);

        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6),
          new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 }));
        shaft.position.y = -0.24;
        racketGroup.add(shaft);

        const frame = new THREE.Mesh(
          new THREE.TorusGeometry(0.1, 0.009, 8, 20),
          new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.3 }));
        frame.position.y = -0.37;
        racketGroup.add(frame);

        const strings = new THREE.Mesh(
          new THREE.CircleGeometry(0.095, 16),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
        strings.position.y = -0.37;
        racketGroup.add(strings);

        elbowPivot.add(racketGroup);
        this.bodyParts.racket = racketGroup;
      }
    }

    this.group.castShadow = true;
  }

  // =============================================
  // REACH ZONES (only created if getReachVisible provided)
  // =============================================
  _createReachZones() {
    this._racketSideSign = this.handedness === 'right' ? -1 : 1;

    this._gradientColors = [
      new THREE.Color(0x16a34a),
      new THREE.Color(0x4ade80),
      new THREE.Color(0xfacc15),
      new THREE.Color(0xf97316),
      new THREE.Color(0xdc2626),
      new THREE.Color(0x991b1b),
    ];

    const opacity = this._getReachOpacity ? this._getReachOpacity() : 0.15;

    const directGeo = this._makeGradientRingGeo(1.2, 0.7, 0.95, 0.85, 48, 12);
    const directMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity,
      side: THREE.DoubleSide, depthWrite: false
    });
    this.directZone = new THREE.Mesh(directGeo, directMat);
    this.directZone.rotation.x = -Math.PI / 2;
    this.directZone.position.y = 0.03;
    this.directZone.visible = false;
    this.scene.add(this.directZone);

    const impulseGeo = this._makeGradientRingGeo(3.2, 2.2, 2.8, 2.5, 48, 12);
    const impulseMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: opacity * 0.6,
      side: THREE.DoubleSide, depthWrite: false
    });
    this.impulseZone = new THREE.Mesh(impulseGeo, impulseMat);
    this.impulseZone.rotation.x = -Math.PI / 2;
    this.impulseZone.position.y = 0.02;
    this.impulseZone.visible = false;
    this.scene.add(this.impulseZone);
  }

  _sampleGradient(t) {
    const stops = this._gradientColors;
    const n = stops.length - 1;
    const idx = Math.min(t * n, n - 0.001);
    const i = Math.floor(idx);
    const frac = idx - i;
    const c = new THREE.Color();
    c.copy(stops[i]).lerp(stops[i + 1], frac);
    return c;
  }

  _boundaryRadius(angle, rSide, rOpp, rFwd, rBack) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rX = sin > 0 ? rSide : rOpp;
    const rZ = cos > 0 ? rFwd : rBack;
    return 1.0 / Math.sqrt((cos * cos) / (rZ * rZ) + (sin * sin) / (rX * rX));
  }

  _makeGradientRingGeo(rSide, rOpp, rFwd, rBack, angularSegs, radialSegs) {
    const totalVerts = 1 + angularSegs * radialSegs;
    const positions = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);
    const indices = [];

    positions[0] = 0; positions[1] = 0; positions[2] = 0;
    const centerColor = this._sampleGradient(0);
    colors[0] = centerColor.r; colors[1] = centerColor.g; colors[2] = centerColor.b;

    for (let ring = 1; ring <= radialSegs; ring++) {
      const t = ring / radialSegs;
      const gradColor = this._sampleGradient(t);
      for (let seg = 0; seg < angularSegs; seg++) {
        const angle = (seg / angularSegs) * Math.PI * 2;
        const maxR = this._boundaryRadius(angle, rSide, rOpp, rFwd, rBack);
        const r = maxR * t;
        const vi = 1 + (ring - 1) * angularSegs + seg;
        positions[vi * 3] = Math.sin(angle) * r;
        positions[vi * 3 + 1] = Math.cos(angle) * r;
        positions[vi * 3 + 2] = 0;
        colors[vi * 3] = gradColor.r;
        colors[vi * 3 + 1] = gradColor.g;
        colors[vi * 3 + 2] = gradColor.b;
      }
    }

    for (let seg = 0; seg < angularSegs; seg++) {
      const next = (seg + 1) % angularSegs;
      indices.push(0, 1 + seg, 1 + next);
    }
    for (let ring = 1; ring < radialSegs; ring++) {
      const base0 = 1 + (ring - 1) * angularSegs;
      const base1 = 1 + ring * angularSegs;
      for (let seg = 0; seg < angularSegs; seg++) {
        const next = (seg + 1) % angularSegs;
        indices.push(base0 + seg, base1 + seg, base1 + next);
        indices.push(base0 + seg, base1 + next, base0 + next);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  updateReachZones() {
    const visible = this._getReachVisible ? this._getReachVisible() : false;
    this.directZone.visible = visible;
    this.impulseZone.visible = visible;
    if (!visible) return;

    this.directZone.position.set(this.position.x, 0.03, this.position.z);
    this.impulseZone.position.set(this.position.x, 0.02, this.position.z);

    const rackOffset = this._racketSideSign > 0 ? 0 : Math.PI;
    this.directZone.rotation.z = -(this.facingAngle + rackOffset);
    this.impulseZone.rotation.z = -(this.facingAngle + rackOffset);

    const opacity = this._getReachOpacity ? this._getReachOpacity() : 0.15;
    this.directZone.material.opacity = opacity;
    this.impulseZone.material.opacity = opacity * 0.6;
  }

  // =============================================
  // LABEL (only created if getCamera provided)
  // =============================================
  _createLabel() {
    this._labelDiv = document.createElement('div');
    this._labelDiv.style.cssText = `
      position:fixed;pointer-events:none;z-index:5;
      font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;
      background:rgba(255,255,255,0.85);backdrop-filter:blur(4px);
      white-space:nowrap;transform:translate(-50%,-100%);
      box-shadow:0 1px 4px rgba(0,0,0,0.12);
      border:1px solid ${this.team === 'A' ? 'rgba(37,99,235,0.35)' : 'rgba(220,38,38,0.35)'};
      color:${this.team === 'A' ? '#1d4ed8' : '#b91c1c'}
    `;
    this._labelDiv.textContent = this.name;
    document.body.appendChild(this._labelDiv);
    if (this._onLabelCreated) this._onLabelCreated(this._labelDiv);
  }

  updateLabel() {
    const cam = this._getCamera();
    const pos = this.group.position.clone();
    pos.y += PLAYER_H * this.bodyScale + 0.3;
    pos.project(cam);
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
    this._labelDiv.style.left = x + 'px';
    this._labelDiv.style.top = y + 'px';

    const roleText = this.role === 'front' ? '▲ Front' : '▼ Back';
    this._labelDiv.textContent = `${this.name} ${this.handedness === 'left' ? '(L)' : ''} — ${roleText}`;
  }

  // =============================================
  // POSITION / MOVEMENT
  // =============================================
  setPosition(x, z) {
    this.targetPosition.set(x, 0, z);
  }

  teleport(x, z) {
    this.position.set(x, 0, z);
    this.targetPosition.set(x, 0, z);
    this.group.position.set(x, this.groundOffset, z);
  }

  startSwing(type, shuttleWorldPos) {
    this.swingPhase = 0;
    this.swingType = type;

    // Store shuttle contact position for aiming the racket
    this._swingTarget = shuttleWorldPos ? shuttleWorldPos.clone() : null;

    if (type === 'smash' || type === 'clear' || type === 'serve_flick' || type === 'serve_high') {
      this.jumpPhase = 0;
      this.jumpHeight = type === 'smash' ? this.jumpHeights.smash : this.jumpHeights.overhead;
      this.jumpDuration = 0.35;
    } else if (type === 'net' && this.role === 'front') {
      this.jumpPhase = 0;
      this.jumpHeight = this.jumpHeights.netHop;
      this.jumpDuration = 0.25;
    }
  }

  // =============================================
  // UPDATE (called every frame)
  // =============================================
  update(dt) {
    // Movement
    const diff = new THREE.Vector3().subVectors(this.targetPosition, this.position);
    const dist = diff.length();
    this.isMoving = dist > 0.05;

    if (this.isMoving) {
      const speed = 4.5;
      const step = Math.min(speed * dt, dist);
      const dir = diff.normalize();
      this.position.addScaledVector(dir, step);
    }

    // Body always faces the net (badminton footwork — shuffle sideways, don't turn away)
    if (this._idleFacing === 'net') {
      const netDir = this.team === 'A' ? 1 : -1;
      this.targetFacingAngle = netDir > 0 ? 0 : Math.PI;
    }

    // Smooth facing
    let angleDiff = this.targetFacingAngle - this.facingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.facingAngle += angleDiff * Math.min(1, 8 * dt);

    // Jump physics (for smash/clear)
    let jumpY = 0;
    if (this.jumpPhase >= 0) {
      this.jumpPhase += dt / this.jumpDuration;
      if (this.jumpPhase > 1) {
        this.jumpPhase = -1;
      } else {
        const t = this.jumpPhase;
        const tPeak = 0.35;
        const g = 2 * this.jumpHeight / (tPeak * tPeak);
        const v0 = g * tPeak;
        jumpY = Math.max(0, v0 * t - 0.5 * g * t * t);
      }
    }

    // Split step: small hop when transitioning from idle to moving
    let splitStepY = 0;
    if (!this._prevMoving && this.isMoving && this.splitStepPhase < 0) {
      this.splitStepPhase = 0;
      this.footworkState = 'splitStep';
    }
    if (this.splitStepPhase >= 0) {
      this.splitStepPhase += dt * 6; // fast hop ~0.17s
      if (this.splitStepPhase > 1) {
        this.splitStepPhase = -1;
        this.footworkState = 'moving';
      } else {
        splitStepY = 0.06 * Math.sin(this.splitStepPhase * Math.PI); // small hop
      }
    }
    this._prevMoving = this.isMoving;

    this.group.position.set(this.position.x, this.groundOffset + jumpY + splitStepY, this.position.z);
    this.group.rotation.y = this.facingAngle;

    // Determine footwork state
    if (!this.isMoving && this.splitStepPhase < 0 && this.lungePhase < 0) {
      this.footworkState = 'ready';
    } else if (this.isMoving && this.splitStepPhase < 0 && this.lungePhase < 0) {
      this.footworkState = 'moving';
    }

    // Lunge: triggered when swinging and close to target (reaching for shuttle)
    if (this.swingPhase >= 0 && this.swingPhase < 0.1 && this.lungePhase < 0 && this.jumpPhase < 0) {
      const shotNeedsLunge = ['net', 'drop', 'lift', 'drive', 'serve_short'].includes(this.swingType);
      if (shotNeedsLunge) {
        this.lungePhase = 0;
        this.lungeSide = Math.random() > 0.5 ? 1 : -1; // which foot leads
        this.footworkState = 'lunging';
      }
    }
    if (this.lungePhase >= 0) {
      this.lungePhase += dt * 3; // ~0.33s lunge
      if (this.lungePhase > 1) this.lungePhase = -1;
    }

    // Head tracks shuttlecock (if available)
    const head = this.bodyParts.head;
    const shuttle = this._getShuttlecock?.();
    if (head && shuttle?.active) {
      const shuttleWorld = shuttle.group.position;
      const localPos = this.group.worldToLocal(shuttleWorld.clone());
      const dx = localPos.x - head.position.x;
      const dy = localPos.y - head.position.y;
      const dz = localPos.z - head.position.z;
      const yaw = Math.atan2(dx, dz);
      head.rotation.y = Math.max(-0.8, Math.min(0.8, yaw));
      const hDist = Math.sqrt(dx * dx + dz * dz);
      const pitch = -Math.atan2(dy, hDist);
      head.rotation.x = Math.max(-0.5, Math.min(0.4, pitch));
    } else if (head) {
      head.rotation.y *= 0.9;
      head.rotation.x *= 0.9;
    }

    // =============================================
    // FOOTWORK ANIMATIONS
    // =============================================
    const bp = this.bodyParts;

    if (this.footworkState === 'ready') {
      // Athletic ready stance: knees bent, weight on balls of feet, slight bounce
      this.walkCycle += dt * 3;
      const bounce = Math.sin(this.walkCycle * 2) * 0.02;
      const readyKnee = 0.25; // deeper bend than before

      if (bp.leftLeg)  bp.leftLeg.rotation.x = 0.08 + bounce;
      if (bp.rightLeg) bp.rightLeg.rotation.x = 0.08 - bounce;
      if (bp.leftKnee)  bp.leftKnee.rotation.x = readyKnee + bounce;
      if (bp.rightKnee) bp.rightKnee.rotation.x = readyKnee - bounce;

      // Arms: relaxed ready position, slight bounce
      if (bp.freeArm) bp.freeArm.rotation.x = -0.4 + bounce;
      if (bp.freeArmElbow) bp.freeArmElbow.rotation.x = -0.5;

    } else if (this.footworkState === 'splitStep') {
      // Split step: both legs spread apart, knees bend on landing
      const t = this.splitStepPhase;
      const spread = Math.sin(t * Math.PI) * 0.3;
      const kneeBend = t > 0.5 ? (t - 0.5) * 2 * 0.5 : 0; // bend on landing

      if (bp.leftLeg)  bp.leftLeg.rotation.x = -spread * 0.3;
      if (bp.rightLeg) bp.rightLeg.rotation.x = spread * 0.3;
      if (bp.leftLeg)  bp.leftLeg.rotation.z = spread; // legs splay out
      if (bp.rightLeg) bp.rightLeg.rotation.z = -spread;
      if (bp.leftKnee)  bp.leftKnee.rotation.x = 0.1 + kneeBend;
      if (bp.rightKnee) bp.rightKnee.rotation.x = 0.1 + kneeBend;

      if (bp.freeArm) bp.freeArm.rotation.x = -0.5;
      if (bp.freeArmElbow) bp.freeArmElbow.rotation.x = -0.6;

    } else if (this.footworkState === 'lunging') {
      // Lunge: front leg bends deep, back leg extends
      const t = this.lungePhase;
      // Smooth in-out: accelerate into lunge, hold, recover
      const lungeDepth = t < 0.4 ? (t / 0.4) : (t < 0.7 ? 1.0 : 1.0 - (t - 0.7) / 0.3);
      const ld = lungeDepth;

      const frontLeg = this.lungeSide > 0 ? 'right' : 'left';
      const backLeg = this.lungeSide > 0 ? 'left' : 'right';

      // Front leg: big step forward, deep knee bend
      if (bp[frontLeg + 'Leg']) bp[frontLeg + 'Leg'].rotation.x = -ld * 0.9; // forward
      if (bp[frontLeg + 'Knee']) bp[frontLeg + 'Knee'].rotation.x = ld * 1.2; // deep bend

      // Back leg: extends behind, slight knee bend
      if (bp[backLeg + 'Leg']) bp[backLeg + 'Leg'].rotation.x = ld * 0.6; // backward
      if (bp[backLeg + 'Knee']) bp[backLeg + 'Knee'].rotation.x = ld * 0.15; // nearly straight

      // Body leans forward into lunge
      if (bp.torso) bp.torso.rotation.x = -ld * 0.15;

      // Free arm back for balance
      if (bp.freeArm) bp.freeArm.rotation.x = -0.3 + ld * 0.5;
      if (bp.freeArmElbow) bp.freeArmElbow.rotation.x = -0.3 - ld * 0.3;

    } else if (this.footworkState === 'moving') {
      // Running/shuffling: quick steps, badminton-style (light, on toes)
      this.walkCycle += dt * 12; // faster cadence than before
      const hipSwing = Math.sin(this.walkCycle) * 0.35;
      // Shorter, quicker knee lifts — badminton shuffle, not jogging
      const leftKneeBend = Math.max(0, Math.sin(this.walkCycle)) * 0.55;
      const rightKneeBend = Math.max(0, -Math.sin(this.walkCycle)) * 0.55;

      if (bp.leftLeg) bp.leftLeg.rotation.x = hipSwing;
      if (bp.rightLeg) bp.rightLeg.rotation.x = -hipSwing;
      if (bp.leftLeg) bp.leftLeg.rotation.z = 0; // reset any splay from split step
      if (bp.rightLeg) bp.rightLeg.rotation.z = 0;
      if (bp.leftKnee) bp.leftKnee.rotation.x = leftKneeBend;
      if (bp.rightKnee) bp.rightKnee.rotation.x = rightKneeBend;

      // Arms pump lightly
      if (bp.freeArm) bp.freeArm.rotation.x = -0.5 - hipSwing * 0.3;
      if (bp.freeArmElbow) {
        const elbowBend = Math.max(0, Math.sin(this.walkCycle)) * 0.4 + 0.4;
        bp.freeArmElbow.rotation.x = -elbowBend;
      }
    }

    // Reset torso lean when not lunging
    if (this.footworkState !== 'lunging' && bp.torso) {
      bp.torso.rotation.x *= 0.85; // smooth recovery
    }

    // Racket arm: ready position + swing animation (shoulder + elbow)
    const arm = this.bodyParts.racketArm;
    const elbow = this.bodyParts.racketArmElbow;
    if (arm) {
      const isFront = this.role === 'front';
      const readyX = isFront ? -1.2 : -0.7;
      const readyZ = 0.1;
      const readyElbow = isFront ? -0.8 : -0.5;
      const bob = Math.sin(this.walkCycle * 1.5) * 0.05;

      // Compute aim offset: rotate shoulder Y to point racket toward shuttle
      let aimY = 0;
      if (this._swingTarget && this.swingPhase >= 0) {
        const localTarget = this.group.worldToLocal(this._swingTarget.clone());
        // Yaw toward shuttle in local space (clamped)
        aimY = Math.max(-0.6, Math.min(0.6, Math.atan2(localTarget.x, localTarget.z)));
      }

      if (this.swingPhase >= 0) {
        this.swingPhase += dt * this.swingSpeed;
        if (this.swingPhase > 1) {
          this.swingPhase = -1;
          this._swingTarget = null;
        } else {
          const t = this.swingPhase;
          // Apply aim during active swing phases (wind-up through strike)
          const aimBlend = t < 0.5 ? 1.0 : Math.max(0, 1.0 - (t - 0.5) / 0.5); // fade out on follow-through
          arm.rotation.y = aimY * aimBlend;

          if (this.swingType === 'smash' || this.swingType === 'clear' || this.swingType === 'serve_flick' || this.swingType === 'serve_high') {
            if (t < 0.3) {
              const wind = t / 0.3;
              arm.rotation.x = readyX + (-Math.PI * 1.15 - readyX) * wind;
              arm.rotation.z = wind * 0.3;
              if (elbow) elbow.rotation.x = readyElbow + (-1.8 - readyElbow) * wind;
            } else if (t < 0.5) {
              const strike = (t - 0.3) / 0.2;
              arm.rotation.x = -Math.PI * 1.15 + Math.PI * 0.35 * strike;
              arm.rotation.z = 0.3 - strike * 0.15;
              if (elbow) elbow.rotation.x = -1.8 + 1.8 * strike;
            } else {
              const follow = (t - 0.5) / 0.5;
              arm.rotation.x = -Math.PI * 0.8 + Math.PI * 0.9 * follow;
              arm.rotation.z = 0.15 * (1 - follow);
              if (elbow) elbow.rotation.x = -0.3 * (1 - follow) + readyElbow * follow;
            }
          } else if (this.swingType === 'drop' || this.swingType === 'net' || this.swingType === 'serve_short') {
            const push = Math.sin(t * Math.PI);
            arm.rotation.x = readyX - push * 0.5;
            arm.rotation.z = readyZ + push * 0.25;
            if (elbow) elbow.rotation.x = readyElbow + push * 0.4;
          } else if (this.swingType === 'lift') {
            if (t < 0.4) {
              const down = t / 0.4;
              arm.rotation.x = readyX + (0.3 - readyX) * down;
              arm.rotation.z = readyZ;
              if (elbow) elbow.rotation.x = readyElbow + (0.2 - readyElbow) * down;
            } else {
              const up = (t - 0.4) / 0.6;
              arm.rotation.x = 0.3 - Math.PI * 0.8 * up;
              arm.rotation.z = readyZ + up * 0.2;
              if (elbow) elbow.rotation.x = 0.2 - 1.2 * up;
            }
          } else {
            const side = Math.sin(t * Math.PI);
            arm.rotation.x = readyX - side * 0.3;
            arm.rotation.z = readyZ - side * 1.0;
            if (elbow) elbow.rotation.x = readyElbow - side * 0.6;
          }
        }
      }

      if (this.swingPhase < 0) {
        arm.rotation.x = readyX + bob;
        arm.rotation.y = 0;
        arm.rotation.z = readyZ;
        if (elbow) elbow.rotation.x = readyElbow + bob * 0.5;
      }
    }

    // Optional features
    if (this._getCamera) this.updateLabel();
    if (this._getReachVisible) this.updateReachZones();
  }
}
