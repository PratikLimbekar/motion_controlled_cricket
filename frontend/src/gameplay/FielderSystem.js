import * as THREE from 'three';

import { config } from '../config.js';

let heatMap = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
let fielders = [];

export function initFielders(sceneFielders) {
  fielders = sceneFielders;
  for (let i = 0; i < fielders.length; i++) {
    fielders[i].userData = {
      ...fielders[i].userData,
      basePos: new THREE.Vector3(),
      isDeep: false,
      isFumbling: false,
      hasCheckedCatch: false,
      role: config.FIELDER_ROLES[i]
    };
  }
  _recomputeTargets(0);
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
  let fieldedResult = { fielded: false, caught: false, fielderName: null, fumbling: false };
  
  // Ignore fumbling
  let activeFielders = fielders.filter(f => !f.userData.isFumbling);
  
  // Sort by distance to ball
  activeFielders.sort((a, b) => a.position.distanceToSquared(ball.position) - b.position.distanceToSquared(ball.position));
  
  // Check catch/fumble logic FIRST
  for (let f of activeFielders) {
     if (ball.position.y > config.MAX_CATCH_HEIGHT) continue; 
     
     let catchRadius = config.CATCH_RADIUS_GROUND;
     if (isAirborne) catchRadius = config.CATCH_RADIUS_AIR;
     
     if (f.position.distanceTo(ball.position) < catchRadius) {
        if (f.userData.hasCheckedCatch) continue;
        f.userData.hasCheckedCatch = true;
        
        let prob = isAirborne ? config.CATCH_PROB_AIR : config.CATCH_PROB_GROUND;
        if (ballVelocity.lengthSq() > 50*50) prob -= 0.12;
        
        if (Math.random() > prob) {
           f.userData.isFumbling = true;
           setTimeout(() => f.userData.isFumbling = false, 500);
           fieldedResult.fumbling = true;
           continue; // Look for next fielder to field it
        } else {
           return { fielded: true, caught: isAirborne, fielderName: f.userData.role.name, fumbling: false };
        }
     }
  }
  
  // Move 2 closest fielders
  for (let i = 0; i < Math.min(2, activeFielders.length); i++) {
     const f = activeFielders[i];
     
     let targetPos = ball.position.clone();
     const ballSpeed = ballVelocity.length();
     
     if (ballSpeed > 5) {
        let lookAhead = 0.7;
        if (ballVelocity.y > 0) {
           let timeToLand = (2 * ballVelocity.y) / 19.6;
           lookAhead = Math.min(timeToLand, 1.2);
        }
        targetPos.add(ballVelocity.clone().multiplyScalar(lookAhead));
     }
     
     clampToBoundary(targetPos, 2.0); // 20 units scaled is ~1.8
     
     const dir = targetPos.clone().sub(f.position);
     dir.y = 0;
     const dist = dir.length();
     
     const speed = config.FIELDER_SPEED;
     if (dist > 0.1) {
        dir.normalize();
        f.position.addScaledVector(dir, Math.min(speed * delta, dist));
     }
     
     clampToBoundary(f.position, 1.5);
  }
  
  return fieldedResult;
}

export function resetFielderStates() {
  for (let f of fielders) {
     f.userData.hasCheckedCatch = false;
     f.userData.isFumbling = false;
  }
}

export function lerpFieldersToBase(delta) {
  for (let f of fielders) {
    if (f.position.distanceTo(f.userData.basePos) > 0.1) {
      f.position.lerp(f.userData.basePos, 5.0 * delta); // smooth return
    }
  }
}
