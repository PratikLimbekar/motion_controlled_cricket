import * as THREE from 'three';

import { config } from '../config.js';

let heatMap = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
let fielders = [];

export function initFielders(sceneFielders) {
  fielders = sceneFielders;
  for (let i = 0; i < fielders.length; i++) {
    const role = config.FIELDER_ROLES[i];
    fielders[i].userData = {
      ...fielders[i].userData,
      basePos: new THREE.Vector3(),
      isDeep: false,
      isFumbling: false,
      hasCheckedCatch: false,
      role: role,
      
      // NEW HUMAN-LIKE AI STATE
      velocity: new THREE.Vector3(0, 0, 0),
      forward: new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), role.angle * (Math.PI/180)),
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

function getSkillForRole(name) {
  const s = config.fielderTuning.skills;
  if (name.includes('Slip') || name.includes('Gully')) return s.slip;
  if (name.includes('Point') || name.includes('Cover') || name.includes('Mid')) return s.infield;
  return s.outfield;
}

function clampToBoundary(pos, margin) {
  const maxR = Math.max(0.1, config.BOUNDARY_R - margin);
  const r = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  
  if (r > maxR) {
    pos.x = (pos.x / r) * maxR;
    pos.z = (pos.z / r) * maxR;
  }
}

// Convert angle in degrees + radius to 3D position
function polar(angleDeg, radius) {
  // Angle 0 = Point (+X), Angle 90 = Mid Off (-Z)
  const a = angleDeg * (Math.PI / 180);
  
  let sx = 1.0, sz = 1.0;
  if (radius <= config.INFIELD_R) {
    sx = config.INFIELD_SCALE_X;
    sz = config.INFIELD_SCALE_Z;
  } else {
    // Interpolate from oval scale at infield to circular (1.0) at boundary
    const t = Math.min(1, (radius - config.INFIELD_R) / (config.BOUNDARY_R - config.INFIELD_R));
    sx = config.INFIELD_SCALE_X + (1.0 - config.INFIELD_SCALE_X) * t;
    sz = config.INFIELD_SCALE_Z + (1.0 - config.INFIELD_SCALE_Z) * t;
  }

  const x = Math.cos(a) * radius * sx;
  const z = -Math.sin(a) * radius * sz;
  return new THREE.Vector3(x, 0, z);
}

export function onBallLanded(ballPosition, currentOver) {
  // Angle of ball
  let angleRad = Math.atan2(-ballPosition.z, ballPosition.x);
  if (angleRad < 0) angleRad += 2 * Math.PI;
  const angleDeg = angleRad * (180 / Math.PI);
  
  const hotSector = Math.floor(angleDeg / 45) % 8;
  
  for (let i = 0; i < 8; i++) {
    let diff = Math.abs(i - hotSector);
    if (diff > 4) diff = 8 - diff;
    const boost = Math.max(0, 1 - diff * 0.5);
    heatMap[i] = heatMap[i] + (0.5 + boost * 0.5 - heatMap[i]) * 0.6; // lerp
  }
  
  _recomputeTargets(currentOver);
}

export function updateFieldersEndOfOver(currentOver) {
  for (let i = 0; i < 8; i++) {
    heatMap[i] = heatMap[i] + (0.5 - heatMap[i]) * 0.4;
  }
  _recomputeTargets(currentOver);
}

function _recomputeTargets(currentOver) {
  const maxOutside = currentOver < 6 ? 2 : 5;
  let outsideCount = 0;
  
  const deepThreshold = currentOver < 6 ? 0.55 : 0.30;
  
  let roleScores = config.FIELDER_ROLES.map(role => {
    const sector = Math.floor(role.angle / 45) % 8;
    const nextSector = (sector + 1) % 8;
    const heat = (heatMap[sector] * 0.7) + (heatMap[nextSector] * 0.3);
    return { ...role, heat };
  });
  
  roleScores.sort((a, b) => b.heat - a.heat);
  
  for (let role of roleScores) {
    const sector = Math.floor(role.angle / 45) % 8;
    const sectorCenterAngle = sector * 45 + 22.5;
    
    // Angle Drift
    let diff = sectorCenterAngle - role.angle;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    diff = Math.max(-40, Math.min(40, diff));
    const targetAngle = role.angle + diff * (role.heat * 0.5);
    
    let isDeep = false;
    let targetRadius = role.r;
    
    if (role.heat > deepThreshold && outsideCount < maxOutside) {
       isDeep = true;
       outsideCount++;
       const deepFraction = Math.max(0, Math.min(1, (role.heat - deepThreshold) / (1 - deepThreshold)));
       targetRadius = config.INNER_MAX + (config.DEEP_R - config.INNER_MAX) * deepFraction;
    } else {
       const innerFrac = Math.max(0, Math.min(1, (role.heat - 0.3) / 0.5));
       targetRadius = Math.max(10, role.r * 0.7 + (config.INNER_MAX - role.r * 0.7) * innerFrac);
    }
    
    // Death Overs Final Push
    if (currentOver >= 6 && !isDeep && outsideCount < maxOutside) {
       isDeep = true;
       outsideCount++;
       targetRadius = config.DEEP_R * 0.93;
    }
    
    // Find matching fielder
    const fielder = fielders.find(f => f.userData.role && f.userData.role.name === role.name);
    if (fielder) {
       fielder.userData.basePos = polar(targetAngle, targetRadius);
       fielder.userData.isDeep = isDeep;
    }
  }
}

export function updateFielderChasing(delta, ball, ballVelocity, isAirborne) {
  let fieldedResult = { fielded: false, caught: false, fielderName: null, fumbling: false, isGathering: false };
  const tuning = config.fielderTuning;
  const ballSpeed = ballVelocity.length();

  // 1. Calculate projected target once
  const projectedTarget = ball.position.clone();
  if (ballSpeed > 5) {
     let lookAhead = tuning.lookAheadTime;
     if (ballVelocity.y > 0) {
        let timeToLand = (2 * ballVelocity.y) / config.physics.gravity;
        lookAhead = Math.min(timeToLand, 1.2);
     }
     projectedTarget.add(ballVelocity.clone().multiplyScalar(lookAhead));
  }
  projectedTarget.y = 0;

  // 2. Sorting & Vision/Reaction Filtering
  let fieldersWithIntel = fielders.map(f => {
     if (f.userData.isFumbling) return { f, score: Infinity, canReact: false };
     
     // Reaction Delay
     f.userData.reactionTimer += delta;
     if (f.userData.reactionTimer < f.userData.reactionTime / f.userData.skill.reaction) {
        return { f, score: Infinity, canReact: false };
     }

     // Vision Cone (Awareness)
     const toBall = ball.position.clone().sub(f.position).normalize();
     const dot = f.userData.forward.dot(toBall);
     if (dot < tuning.visionConeThreshold && ball.position.distanceTo(f.position) > 30) {
        return { f, score: Infinity, canReact: false };
     }

     return { f, score: f.position.distanceToSquared(projectedTarget), canReact: true };
  });

  fieldersWithIntel.sort((a, b) => a.score - b.score);
  const activeChasers = fieldersWithIntel.filter(item => item.canReact).slice(0, 3);

  // 3. Catch & Gather Logic
  for (let item of fieldersWithIntel) {
     const f = item.f;
     if (!item.canReact || f.userData.isFumbling) continue;

     if (f.userData.isGathering) {
        f.userData.gatheringTimer += delta;
        fieldedResult.isGathering = true; // Signal main loop to stop ball
        if (f.userData.gatheringTimer >= tuning.gatheringWaitTime) {
           return { fielded: true, caught: f.userData.caughtLast, fielderName: f.userData.role.name, fumbling: false };
        }
        return fieldedResult;
     }

     const dx = f.position.x - ball.position.x;
     const dz = f.position.z - ball.position.z;
     const dist2D = Math.sqrt(dx*dx + dz*dz);
     const catchRadius = isAirborne ? tuning.catchRadiusAir : tuning.catchRadiusGround;

     if (dist2D < catchRadius && ball.position.y < tuning.maxCatchHeight) {
        if (f.userData.hasCheckedCatch) continue;
        f.userData.hasCheckedCatch = true;

        let prob = (isAirborne ? tuning.catchProbAir : tuning.catchProbGround) * f.userData.skill.catching;
        if (ballSpeed > 40) prob -= tuning.fumbleSpeedPenalty;

        if (Math.random() > prob) {
           f.userData.isFumbling = true;
           setTimeout(() => f.userData.isFumbling = false, tuning.fumbleDuration);
           fieldedResult.fumbling = true;
        } else {
           f.userData.isGathering = true;
           f.userData.gatheringTimer = 0;
           f.userData.caughtLast = isAirborne;
           f.userData.velocity.set(0,0,0);
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
     
     // Simplified target logic to reduce jitter
     let moveTarget = projectedTarget.clone();
     if (index === 0) {
        // Primary goes straight for the kill
     } else if (index === 1) { 
        // Backup moves to cover the trajectory line
        const backupOffset = ballVelocity.clone().normalize().multiplyScalar(4);
        moveTarget.add(backupOffset);
     } else {
        // Cover stays closer to boundary
        clampToBoundary(moveTarget, tuning.boundaryMargin + 10);
     }

     if (f.userData.commitTimer <= 0) {
        f.userData.commitTarget.copy(moveTarget);
        f.userData.commitTimer = tuning.commitDuration;
     }

     const dir = f.userData.commitTarget.clone().sub(f.position);
     dir.y = 0;
     const dist = dir.length();

     if (dist > 0.2) {
        dir.normalize();
        const targetVel = dir.multiplyScalar(config.FIELDER_SPEED * f.userData.skill.speed);
        f.userData.velocity.lerp(targetVel, tuning.accelerationFactor);
        f.position.addScaledVector(f.userData.velocity, delta);
        
        if (f.userData.velocity.length() > 0.5) {
           f.userData.forward.lerp(f.userData.velocity.clone().normalize(), 0.1);
        }
     } else {
        f.userData.velocity.lerp(new THREE.Vector3(0,0,0), 0.3);
     }

     clampToBoundary(f.position, 1.5);
  });

  return fieldedResult;
}

export function resetFielderStates() {
  for (let f of fielders) {
     f.userData.hasCheckedCatch = false;
     f.userData.isFumbling = false;
     f.userData.reactionTimer = 0;
     f.userData.commitTimer = 0;
     f.userData.velocity.set(0, 0, 0);
     f.userData.isGathering = false;
     f.userData.gatheringTimer = 0;
  }
}

export function lerpFieldersToBase(delta) {
  for (let f of fielders) {
    if (f.position.distanceTo(f.userData.basePos) > 0.1) {
      f.position.lerp(f.userData.basePos, 5.0 * delta); // smooth return
    }
  }
}
