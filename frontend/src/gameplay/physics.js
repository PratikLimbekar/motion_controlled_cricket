import * as THREE from 'three';
import { config } from '../config.js';

const BALL_RADIUS = config.physics.ballRadius;

const batLocalBox = new THREE.Box3();

export function updateBatHitbox() {
  const { width, height, spineThickness } = config.batSettings;
  const halfW = width / 2;
  const halfT = spineThickness / 2;
  batLocalBox.min.set(-halfW, 0, -halfT);
  batLocalBox.max.set(halfW, height, halfT);
}

updateBatHitbox();

export function detectBatBallContact(batObject, ballObject) {
  const ballWorldPos = ballObject.position.clone();
  const localBallPos = batObject.worldToLocal(ballWorldPos.clone());
  const closestPointLocal = new THREE.Vector3().copy(localBallPos).clamp(batLocalBox.min, batLocalBox.max);
  const effectiveRadius = BALL_RADIUS * config.physics.hitboxMultiplier;
  const distance = closestPointLocal.distanceTo(localBallPos);
  
  if (distance <= effectiveRadius) {
    return {
      isContact: true,
      localBallPos: localBallPos,
      closestPointLocal: closestPointLocal,
      ballWorldPos: ballWorldPos
    };
  }
  return { isContact: false };
}

export function computeShotFromContact(contactInfo, batObject, incomingBallVelocity, batAngularVelocity, swingPower) {
  const { closestPointLocal, localBallPos } = contactInfo;
  
  // Contact point on bat: local Y mapped to [-1, 1] relative to center
  const hitPositionOnBat = Math.max(-1, Math.min(1, (closestPointLocal.y - 1.5) / 1.5));
  const edgeFactor = Math.max(-1, Math.min(1, closestPointLocal.x / 0.25));
  
  // --- IMPROVED NORMAL CALCULATION ---
  // The literal face normal
  const localFaceNormal = new THREE.Vector3(0, 0, -1);
  // The actual contact normal based on the box geometry
  const localContactNormal = new THREE.Vector3().subVectors(localBallPos, closestPointLocal).normalize();
  
  // Blend the normals to "round off" the bat edges. 
  // This prevents the ball from hitting a perfectly flat side and reflecting 180 degrees back.
  // We favor the face normal to ensure the ball follows the intended angle of the blade.
  const normalSmoothing = 0.35; // How much the edge affects the reflection direction
  const smoothedLocalNormal = localFaceNormal.clone().lerp(localContactNormal, normalSmoothing).normalize();
  const worldNormal = smoothedLocalNormal.applyQuaternion(batObject.quaternion).normalize();
  
  // Face normal for horizontal guidance (glances/flicks)
  const worldFaceNormal = localFaceNormal.clone().applyQuaternion(batObject.quaternion).normalize();

  // FIX 4: Normalize Angular Velocity by Axis
  const scaledAngularVelocity = new THREE.Vector3(
    batAngularVelocity.x * 0.5, 
    batAngularVelocity.y * 1.4, 
    batAngularVelocity.z * 1.0
  );

  const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(batObject.quaternion).normalize();
  let swingContribution = scaledAngularVelocity.clone().cross(upVector).multiplyScalar(closestPointLocal.y);
  
  const tangentialDir = new THREE.Vector3(0, 1, 0).cross(worldFaceNormal).normalize();
  swingContribution.addScaledVector(tangentialDir, scaledAngularVelocity.y * 1.2);
  
  // FIX 1: Remap Swing Vector's Coordinate Frame
  const faceAngle = Math.atan2(worldFaceNormal.x, -worldFaceNormal.z); 
  const lateralBias = new THREE.Matrix4().makeRotationY(faceAngle * 1.15); 
  swingContribution.applyMatrix4(lateralBias);

  let d = incomingBallVelocity.clone();
  if (d.lengthSq() < 0.001) d.set(0, 0, 1);
  d.normalize();
  
  const n = worldNormal; // Use the smoothed normal for reflection
  const dot = d.dot(n);
  const r = d.clone().sub(n.clone().multiplyScalar(2 * dot)).normalize();
  
  // FIX 2: Weights Adjustment
  swingContribution.multiplyScalar(0.85);
  let finalDirection = swingContribution.clone().add(r.clone().multiplyScalar(0.15));
  
  // FIX 3: Introduce Face Angle Contribution
  const batFaceNormalHorizontal = new THREE.Vector3(worldFaceNormal.x, 0, worldFaceNormal.z).normalize();
  finalDirection.addScaledVector(batFaceNormalHorizontal, 1.4); 

  // Edge Deflection: Instead of world X, apply deflection relative to the bat's local X-axis
  // This ensures that hitting the "leading edge" pushes the ball away from the bat correctly.
  // We dampen the Z-component to prevent the ball from reflecting 180 degrees back to the bowler when the bat is angled.
  const localXAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(batObject.quaternion);
  const edgeDeflectionDir = new THREE.Vector3(localXAxis.x, localXAxis.y * 0.5, localXAxis.z * 0.2).normalize();
  finalDirection.addScaledVector(edgeDeflectionDir, edgeFactor * 2.8);

  const verticalLift = worldFaceNormal.y;
  finalDirection.y += verticalLift * 2.5;
  finalDirection.y += hitPositionOnBat * 0.4;

  const absEdge = Math.abs(edgeFactor);
  let powerMultiplier = 1.0;
  const edgeThreshold = config.physics.edgeThreshold; 
  
  if (absEdge > edgeThreshold) {
    const penalty = (absEdge - edgeThreshold) * (1.0 - config.physics.edgeForgiveness);
    powerMultiplier = Math.max(0.3, 1.0 - penalty); 
    // Additional edge deflection (relative and dampened)
    finalDirection.addScaledVector(edgeDeflectionDir, edgeFactor * 1.8);
    finalDirection.z += (Math.random() - 0.5) * 0.4;
  }
  
  finalDirection.normalize();
  
  const baseSpeed = config.physics.baseShotSpeed;
  const maxExtraSpeed = config.physics.maxExtraShotSpeed;
  const speed = (baseSpeed + (maxExtraSpeed * swingPower * powerMultiplier)) * config.physics.powerBoost;
  const finalVelocity = finalDirection.multiplyScalar(speed);
  
  return {
    velocity: finalVelocity,
    isEdge: absEdge > edgeThreshold,
    powerPct: Math.round(swingPower * powerMultiplier * 100),
    hitPosition: hitPositionOnBat,
    edgeFactor: edgeFactor
  };
}


export function applyBallVelocity(ballObject, velocity, dt) {
  let bounced = false;
  ballObject.position.addScaledVector(velocity, dt);
  velocity.y -= config.physics.gravity * dt; 
  
  if (ballObject.position.y < config.environment.groundHeight) {
    ballObject.position.y = config.environment.groundHeight;
    velocity.y *= config.physics.bounceFactor;
    velocity.x *= config.physics.friction;
    velocity.z *= config.physics.friction;
    bounced = true;
  }
  return bounced;
}
