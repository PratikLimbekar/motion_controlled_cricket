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
  const { closestPointLocal } = contactInfo;
  
  // Contact point on bat: local Y mapped to [-1, 1] relative to center
  const hitPositionOnBat = Math.max(-1, Math.min(1, (closestPointLocal.y - 1.5) / 1.5));
  const edgeFactor = Math.max(-1, Math.min(1, closestPointLocal.x / 0.25));
  
  const localNormal = new THREE.Vector3(0, 0, -1);
  const worldFaceNormal = localNormal.applyQuaternion(batObject.quaternion).normalize();
  
  const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(batObject.quaternion).normalize();
  const batContactVelocity = batAngularVelocity.clone().cross(upVector).multiplyScalar(closestPointLocal.y);
  
  let d = incomingBallVelocity.clone();
  if (d.lengthSq() < 0.001) d.set(0, 0, 1);
  d.normalize();
  
  const n = worldFaceNormal;
  const dot = d.dot(n);
  const r = d.clone().sub(n.clone().multiplyScalar(2 * dot)).normalize();
  
  const swingContribution = batContactVelocity.clone().multiplyScalar(0.25);
  let finalDirection = r.clone().add(swingContribution);
  
  // High influence from face normal to support "closing the face"
  const verticalLift = worldFaceNormal.y;
  finalDirection.y += verticalLift * 1.5;
  finalDirection.y += hitPositionOnBat * 0.3;

  const absEdge = Math.abs(edgeFactor);
  let powerMultiplier = 1.0;
  const edgeThreshold = config.physics.edgeThreshold; 
  
  if (absEdge > edgeThreshold) {
    const penalty = (absEdge - edgeThreshold) * (1.0 - config.physics.edgeForgiveness);
    powerMultiplier = Math.max(0.3, 1.0 - penalty); 
    finalDirection.x += edgeFactor * (0.2 + Math.random() * 0.3);
    finalDirection.z += (Math.random() - 0.5) * 0.2;
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
