import * as THREE from 'three';
import { config } from '../config.js';

// ─── Module-level state ────────────────────────────────────────────────────
let heatMap = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
let fielders = [];       // 9 regular fielders
let bowlerObj = null;    // Bowler 3D object
let wkObj    = null;     // Wicketkeeper 3D object

// Bowler run-up state
let bowlerRunUpActive   = false;
let bowlerRunUpProgress = 0;     // 0→1
let bowlerRunUpDuration = 1.2;   // seconds
let bowlerReleaseX      = 0;     // X offset chosen at start of delivery
let currentFormat       = 't20'; // Current match format

// ─── Public: Init ─────────────────────────────────────────────────────────
export function initFielders(regularFielders, bowler, wk) {
  fielders  = regularFielders;
  bowlerObj = bowler;
  wkObj     = wk;

  for (let i = 0; i < fielders.length; i++) {
    const role = config.FIELDER_ROLES[i];
    fielders[i].userData = {
      ...fielders[i].userData,
      basePos: new THREE.Vector3(),
      isDeep: false,
      isFumbling: false,
      hasCheckedCatch: false,
      role: role,
      velocity: new THREE.Vector3(0, 0, 0),
      forward: new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), role.angle * (Math.PI / 180)),
      reactionTimer: 0,
      reactionTime: config.fielderTuning.reactionTimeRange.min + Math.random() * (config.fielderTuning.reactionTimeRange.max - config.fielderTuning.reactionTimeRange.min),
      commitTimer: 0,
      commitTarget: new THREE.Vector3(),
      isGathering: false,
      gatheringTimer: 0,
      skill: getSkillForRole(role.name)
    };
  }
  _recomputeTargets(0);
}

// ─── Public: Bowler run-up control ────────────────────────────────────────
export function startBowlerRunUp(duration) {
  // Randomly pick a crease side (-1 = offside, +1 = legside)
  const opts = config.bowlerSettings.offsetOptions;
  bowlerReleaseX      = opts[Math.floor(Math.random() * opts.length)];
  bowlerRunUpDuration = duration;
  bowlerRunUpProgress = 0;
  bowlerRunUpActive   = true;

  if (bowlerObj) {
    bowlerObj.position.set(bowlerReleaseX, 0, config.bowlerSettings.runUpStartZ);
  }
}

/** Call every frame during the run-up phase */
export function updateBowlerRunUp(dt) {
  if (!bowlerRunUpActive || !bowlerObj) return;

  bowlerRunUpProgress = Math.min(1, bowlerRunUpProgress + dt / bowlerRunUpDuration);

  const startZ   = config.bowlerSettings.runUpStartZ;
  const releaseZ = config.bowlerSettings.releaseZ;
  const z = startZ + (releaseZ - startZ) * bowlerRunUpProgress;
  bowlerObj.position.set(bowlerReleaseX, 0, z);

  // Animate legs
  const legAngle = Math.sin(bowlerRunUpProgress * Math.PI * 10) * 0.5;
  const lLeg = bowlerObj.children[7]; if (lLeg) lLeg.rotation.x =  legAngle;
  const rLeg = bowlerObj.children[8]; if (rLeg) rLeg.rotation.x = -legAngle;

  if (bowlerRunUpProgress >= 1) {
    bowlerRunUpActive = false;
  }
}

/** Returns the world X of the bowler at release, so ball can start from there */
export function getBowlerReleaseX() { return bowlerReleaseX; }

export function setFormat(format) {
  currentFormat = format;
}

/** Returns the wicketkeeper's world position (for return throws) */
export function getWicketkeeperPosition() {
  return wkObj ? wkObj.position.clone() : new THREE.Vector3(0, 0.5, config.stumpSettings.posZ_striker + 2.0);
}

/** Returns references to bowler and WK for minimap rendering */
export function getBowlerObject()     { return bowlerObj; }
export function getWicketkeeperObject() { return wkObj; }

// ─── Public: Ball landed / over end ───────────────────────────────────────
export function onBallLanded(ballPosition, currentOver) {
  let angleRad = Math.atan2(-ballPosition.z, ballPosition.x);
  if (angleRad < 0) angleRad += 2 * Math.PI;
  const hotSector = Math.floor(angleRad * (180 / Math.PI) / 45) % 8;
  for (let i = 0; i < 8; i++) {
    let diff = Math.abs(i - hotSector);
    if (diff > 4) diff = 8 - diff;
    const boost = Math.max(0, 1 - diff * 0.5);
    // More aggressive heatmap update (increased from 0.6 to 0.8)
    heatMap[i] = heatMap[i] + (0.5 + boost * 0.5 - heatMap[i]) * 0.8;
  }
  _recomputeTargets(currentOver);
}

export function updateFieldersEndOfOver(currentOver) {
  for (let i = 0; i < 8; i++) {
    heatMap[i] = heatMap[i] + (0.5 - heatMap[i]) * 0.4;
  }
  _recomputeTargets(currentOver);
}

// ─── Public: Per-frame chase update ───────────────────────────────────────
export function updateFielderChasing(delta, ball, ballVelocity, isAirborne) {
  let fieldedResult = { fielded: false, caught: false, fielderName: null, fumbling: false, isGathering: false };
  if (!fielders || fielders.length === 0) return fieldedResult;

  const tuning    = config.fielderTuning;
  const ballSpeed = ballVelocity.length();

  // 1. Calculate projected target
  const projectedTarget = ball.position.clone();
  if (ballSpeed > 5) {
    let lookAhead = tuning.lookAheadTime;
    if (ballVelocity.y > 0) {
      lookAhead = Math.min((2 * ballVelocity.y) / config.physics.gravity, 1.2);
    }
    projectedTarget.add(ballVelocity.clone().multiplyScalar(lookAhead));
  }
  projectedTarget.y = 0;

  // 2. Filter & Sort Fielders
  let fieldersWithIntel = fielders.map(f => {
    if (f.userData.isFumbling) return { f, score: Infinity, canReact: false };
    
    f.userData.reactionTimer += delta;
    
    // Closer fielders react faster
    const distToBall = f.position.distanceTo(ball.position);
    const reactionThreshold = distToBall < 12 ? 0.05 : (f.userData.reactionTime / f.userData.skill.reaction);
    
    if (f.userData.reactionTimer < reactionThreshold) {
      return { f, score: Infinity, canReact: false };
    }

    // Facing factor (removed strict vision cone, just use distance)
    return { f, score: f.position.distanceToSquared(projectedTarget), canReact: true };
  });

  fieldersWithIntel.sort((a, b) => a.score - b.score);
  const activeChasers = fieldersWithIntel.filter(i => i.canReact).slice(0, 3);

  // 3. Catch & Gather Logic
  for (let item of fieldersWithIntel) {
    const f = item.f;
    if (!item.canReact || f.userData.isFumbling) continue;

    if (f.userData.isGathering) {
      f.userData.gatheringTimer += delta;
      fieldedResult.isGathering = true;
      if (f.userData.gatheringTimer >= tuning.gatheringWaitTime) {
        return { fielded: true, caught: f.userData.caughtLast, fielderName: f.userData.role.name, fumbling: false };
      }
      return fieldedResult;
    }

    const dx = f.position.x - ball.position.x;
    const dz = f.position.z - ball.position.z;
    const dist2D     = Math.sqrt(dx * dx + dz * dz);
    const catchRadius = isAirborne ? tuning.catchRadiusAir : tuning.catchRadiusGround;

    if (dist2D < catchRadius && ball.position.y < (tuning.maxCatchHeight + 1.0)) {
      if (f.userData.hasCheckedCatch) continue;
      f.userData.hasCheckedCatch = true;

      let prob = (isAirborne ? tuning.catchProbAir : tuning.catchProbGround) * f.userData.skill.catching;
      if (ballSpeed > 45) prob -= tuning.fumbleSpeedPenalty;

      if (Math.random() > prob) {
        f.userData.isFumbling = true;
        setTimeout(() => f.userData.isFumbling = false, tuning.fumbleDuration);
        fieldedResult.fumbling = true;
      } else {
        f.userData.isGathering    = true;
        f.userData.gatheringTimer = 0;
        f.userData.caughtLast     = isAirborne;
        f.userData.velocity.set(0, 0, 0);
        fieldedResult.isGathering = true;
        return fieldedResult;
      }
    }
  }

  // 4. Movement Logic
  activeChasers.forEach((item, index) => {
    const f = item.f;
    if (f.userData.isGathering) return;

    f.userData.commitTimer -= delta;
    
    let moveTarget = projectedTarget.clone();
    if (index === 1) { // Cover the line
      moveTarget.add(ballVelocity.clone().normalize().multiplyScalar(5));
    } else if (index === 2) { // Stay deep
      clampToBoundary(moveTarget, tuning.boundaryMargin + 5);
    }

    if (f.userData.commitTimer <= 0) {
      f.userData.commitTarget.copy(moveTarget);
      f.userData.commitTimer = tuning.commitDuration;
    }

    const diff = f.userData.commitTarget.clone().sub(f.position);
    diff.y = 0;
    const dist = diff.length();

    if (dist > 0.1) {
      const dir = diff.normalize();
      const targetVel = dir.multiplyScalar(config.FIELDER_SPEED * f.userData.skill.speed);
      f.userData.velocity.lerp(targetVel, tuning.accelerationFactor * 2.5); // Snappier
      f.position.addScaledVector(f.userData.velocity, delta);
      
      if (f.userData.velocity.length() > 0.5) {
        f.userData.forward.lerp(f.userData.velocity.clone().normalize(), 0.15);
      }
    } else {
      f.userData.velocity.lerp(new THREE.Vector3(0,0,0), 0.2);
    }
    
    clampToBoundary(f.position, 1.5);
  });

  return fieldedResult;
}

// ─── Public: Reset / lerp back ────────────────────────────────────────────
export function resetFielderStates() {
  for (let f of fielders) {
    f.userData.hasCheckedCatch = false;
    f.userData.isFumbling      = false;
    f.userData.reactionTimer   = 0;
    f.userData.commitTimer     = 0;
    f.userData.velocity.set(0, 0, 0);
    f.userData.isGathering     = false;
    f.userData.gatheringTimer  = 0;
  }
}

export function lerpFieldersToBase(delta) {
  for (let f of fielders) {
    if (f.position.distanceTo(f.userData.basePos) > 0.1) {
      f.position.lerp(f.userData.basePos, 5.0 * delta);
    }
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────
function getSkillForRole(name) {
  const s = config.fielderTuning.skills;
  if (name.includes('Slip') || name.includes('Gully')) return s.slip;
  if (name.includes('Point') || name.includes('Cover') || name.includes('Mid')) return s.infield;
  return s.outfield;
}

function clampToBoundary(pos, margin) {
  const maxR = Math.max(0.1, config.BOUNDARY_R - margin);
  const r    = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  if (r > maxR) { pos.x = (pos.x / r) * maxR; pos.z = (pos.z / r) * maxR; }
}

function polar(angleDeg, radius) {
  const a = angleDeg * (Math.PI / 180);
  let sx = 1.0, sz = 1.0;
  if (radius <= config.INFIELD_R) {
    sx = config.INFIELD_SCALE_X; sz = config.INFIELD_SCALE_Z;
  } else {
    const t = Math.min(1, (radius - config.INFIELD_R) / (config.BOUNDARY_R - config.INFIELD_R));
    sx = config.INFIELD_SCALE_X + (1.0 - config.INFIELD_SCALE_X) * t;
    sz = config.INFIELD_SCALE_Z + (1.0 - config.INFIELD_SCALE_Z) * t;
  }
  return new THREE.Vector3(Math.cos(a) * radius * sx, 0, -Math.sin(a) * radius * sz);
}

function _recomputeTargets(currentOver) {
  const format = config.formatSettings[currentFormat];
  // Make it so that even test format isn't fixed forever, and matches the 'before' behavior
  const isPowerplay = (currentFormat === 'test' && currentOver < 1) || 
                      (currentFormat === 'odi' && currentOver < 10) || 
                      (currentFormat === 't20' && currentOver < 6) || 
                      (currentFormat === 'ipl' && currentOver < 6);
  
  const maxOutside = isPowerplay ? (format?.powerplay?.deep ?? 2) : 5;
  const deepThreshold = isPowerplay ? 0.45 : 0.25; // Lowered from 0.55/0.3
  let outsideCount = 0;

  let roleScores = config.FIELDER_ROLES.map(role => {
    const sector     = Math.floor(role.angle / 45) % 8;
    const nextSector = (sector + 1) % 8;
    const heat = (heatMap[sector] * 0.7) + (heatMap[nextSector] * 0.3);
    return { ...role, heat };
  });
  roleScores.sort((a, b) => b.heat - a.heat);

  for (let role of roleScores) {
    const sector          = Math.floor(role.angle / 45) % 8;
    const sectorCenter    = sector * 45 + 22.5;
    let diff = sectorCenter - role.angle;
    if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
    diff = Math.max(-40, Math.min(40, diff));
    const targetAngle = role.angle + diff * (role.heat * 0.5);
    let isDeep = false, targetRadius = role.r;

    if (role.heat > deepThreshold && outsideCount < maxOutside) {
      isDeep = true; outsideCount++;
      const deepFrac = Math.max(0, Math.min(1, (role.heat - deepThreshold) / (1 - deepThreshold)));
      targetRadius = config.INNER_MAX + (config.DEEP_R - config.INNER_MAX) * deepFrac;
    } else {
      const innerFrac = Math.max(0, Math.min(1, (role.heat - 0.3) / 0.5));
      targetRadius = Math.max(10, role.r * 0.7 + (config.INNER_MAX - role.r * 0.7) * innerFrac);
    }
    if (currentOver >= 6 && !isDeep && outsideCount < maxOutside) {
      isDeep = true; outsideCount++; targetRadius = config.DEEP_R * 0.93;
    }

    const fielder = fielders.find(f => f.userData.role && f.userData.role.name === role.name);
    if (fielder) {
      fielder.userData.basePos = polar(targetAngle, targetRadius);
      fielder.userData.isDeep  = isDeep;
    }
  }
}
