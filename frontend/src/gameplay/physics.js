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

// Pre-allocated static vectors for performance to prevent Garbage Collection thrashing
const _tempBallWorldPos = new THREE.Vector3();
const _tempLocalBallPos = new THREE.Vector3();
const _tempClosestPointLocal = new THREE.Vector3();

const _localFaceNormal = new THREE.Vector3(0, 0, -1);
const _localContactNormal = new THREE.Vector3();
const _worldNormal = new THREE.Vector3();
const _worldFaceNormal = new THREE.Vector3();
const _scaledAngularVelocity = new THREE.Vector3();
const _upVector = new THREE.Vector3();
const _swingContribution = new THREE.Vector3();
const _tangentialDir = new THREE.Vector3();
const _r = new THREE.Vector3();
const _finalDirection = new THREE.Vector3();
const _batFaceNormalHorizontal = new THREE.Vector3();
const _localXAxis = new THREE.Vector3();
const _edgeDeflectionDir = new THREE.Vector3();
const _finalVelocity = new THREE.Vector3();

export function detectBatBallContact(batObject, ballObject) {
  _tempBallWorldPos.copy(ballObject.position);
  _tempLocalBallPos.copy(_tempBallWorldPos);
  batObject.worldToLocal(_tempLocalBallPos);
  _tempClosestPointLocal.copy(_tempLocalBallPos).clamp(batLocalBox.min, batLocalBox.max);
  
  const effectiveRadius = BALL_RADIUS * config.physics.hitboxMultiplier;
  const distance = _tempClosestPointLocal.distanceTo(_tempLocalBallPos);
  
  if (distance <= effectiveRadius) {
    return {
      isContact: true,
      localBallPos: _tempLocalBallPos.clone(),
      closestPointLocal: _tempClosestPointLocal.clone(),
      ballWorldPos: _tempBallWorldPos.clone()
    };
  }
  return { isContact: false };
}

export function computeShotFromContact(contactInfo, batObject, incomingBallVelocity, batAngularVelocity, swingPower, weightTransfer = 0.0) {
  const { closestPointLocal, localBallPos } = contactInfo;
  
  // Contact point on bat: local Y mapped to [-1, 1] relative to center
  const hitPositionOnBat = Math.max(-1, Math.min(1, (closestPointLocal.y - 1.5) / 1.5));
  const edgeFactor = Math.max(-1, Math.min(1, closestPointLocal.x / 0.25));
  
  // --- IMPROVED NORMAL CALCULATION ---
  // The actual contact normal based on the box geometry
  _localContactNormal.subVectors(localBallPos, closestPointLocal).normalize();
  
  // Blend the normals to "round off" the bat edges. 
  const normalSmoothing = 0.35; // How much the edge affects the reflection direction
  _worldNormal.copy(_localFaceNormal).lerp(_localContactNormal, normalSmoothing).normalize();
  _worldNormal.applyQuaternion(batObject.quaternion).normalize();
  
  // Face normal for horizontal guidance (glances/flicks)
  _worldFaceNormal.copy(_localFaceNormal).applyQuaternion(batObject.quaternion).normalize();

  // FIX 4: Normalize Angular Velocity by Axis
  _scaledAngularVelocity.set(
    batAngularVelocity.x * 0.5, 
    batAngularVelocity.y * 1.4, 
    batAngularVelocity.z * 1.0
  );

  _upVector.set(0, 1, 0).applyQuaternion(batObject.quaternion).normalize();
  _swingContribution.copy(_scaledAngularVelocity).cross(_upVector).multiplyScalar(closestPointLocal.y);
  
  _tangentialDir.set(0, 1, 0).cross(_worldFaceNormal).normalize();
  _swingContribution.addScaledVector(_tangentialDir, _scaledAngularVelocity.y * 1.2);
  
  // FIX 1: Remap Swing Vector's Coordinate Frame
  const faceAngle = Math.atan2(_worldFaceNormal.x, -_worldFaceNormal.z); 
  _swingContribution.applyAxisAngle(new THREE.Vector3(0, 1, 0), faceAngle * 0.15); // Lightweight rotation in-place

  _r.copy(incomingBallVelocity);
  if (_r.lengthSq() < 0.001) _r.set(0, 0, 1);
  _r.normalize();
  
  const dot = _r.dot(_worldNormal); // Use the smoothed normal for reflection
  _r.addScaledVector(_worldNormal, -2 * dot).normalize();
  
  // FIX 2: Weights Adjustment
  _swingContribution.multiplyScalar(0.85);
  _finalDirection.copy(_swingContribution).addScaledVector(_r, 0.15);
  
  // FIX 3: Introduce Face Angle Contribution
  _batFaceNormalHorizontal.set(_worldFaceNormal.x, 0, _worldFaceNormal.z).normalize();
  _finalDirection.addScaledVector(_batFaceNormalHorizontal, 1.4); 

  // Edge Deflection: Instead of world X, apply deflection relative to the bat's local X-axis
  _localXAxis.set(1, 0, 0).applyQuaternion(batObject.quaternion);
  _edgeDeflectionDir.set(_localXAxis.x, _localXAxis.y * 0.5, _localXAxis.z * 0.2).normalize();
  _finalDirection.addScaledVector(_edgeDeflectionDir, edgeFactor * 2.8);

  const verticalLift = _worldFaceNormal.y;
  _finalDirection.y += verticalLift * 2.5;
  _finalDirection.y += hitPositionOnBat * 0.4;

  const absEdge = Math.abs(edgeFactor);
  let powerMultiplier = 1.0;
  const edgeThreshold = config.physics.edgeThreshold; 
  
  if (absEdge > edgeThreshold) {
    const penalty = (absEdge - edgeThreshold) * (1.0 - config.physics.edgeForgiveness);
    powerMultiplier = Math.max(0.3, 1.0 - penalty); 
    // Additional edge deflection (relative and dampened)
    _finalDirection.addScaledVector(_edgeDeflectionDir, edgeFactor * 1.8);
    _finalDirection.z += (Math.random() - 0.5) * 0.4;
  }
  
  _finalDirection.normalize();
  
  const baseSpeed = config.physics.baseShotSpeed;
  const maxExtraSpeed = config.physics.maxExtraShotSpeed;
  let speed = (baseSpeed + (maxExtraSpeed * swingPower * powerMultiplier)) * config.physics.powerBoost;

  // Integrate Upper-Body Weight Transfer (Front vs. Back foot modifiers)
  if (weightTransfer > 0.5) {
     // Front Foot: ground the ball more, give extra power boost for middling forward drives
     _finalDirection.y = Math.max(-0.05, _finalDirection.y - 0.25);
     speed *= 1.12; 
  } else if (weightTransfer < -0.5) {
     // Back Foot: give horizontal late deflection boost for pull/cut shots
     _finalDirection.z += Math.sign(_finalDirection.z) * 0.15;
  }

  _finalDirection.normalize();
  _finalVelocity.copy(_finalDirection).multiplyScalar(speed);
  
  return {
    velocity: _finalVelocity.clone(), // Clone only when returning the final resulting velocity vector
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
