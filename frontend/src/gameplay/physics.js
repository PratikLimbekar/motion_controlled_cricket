import * as THREE from 'three';
import { config } from '../config.js';

const BALL_RADIUS = 0.2;

// Tunable Physics/Difficulty Parameters
export const physicsSettings = {
  hitboxMultiplier: 2.5,     // Makes the bat's collision area larger (1.0 = strict, >1.0 = easier)
  edgeForgiveness: 0.5,      // Reduces the penalty when hitting off-center (0.0 to 1.0)
  powerBoost: 1.2            // Overall multiplier to shot speed
};

// The bat blade dimensions in the pivot's local space
// From setupScene: position is (0, 1.5, 0) and geometry is Box(0.5, 3, 0.2)
const batLocalBox = new THREE.Box3();

export function updateBatHitbox() {
  const { width, height, spineThickness } = config.batSettings;
  const halfW = width / 2;
  const halfT = spineThickness / 2;
  batLocalBox.min.set(-halfW, 0, -halfT);
  batLocalBox.max.set(halfW, height, halfT);
}

updateBatHitbox(); // Initial call

export function detectBatBallContact(batObject, ballObject) {
  // 1. Convert ball world position to bat local space
  const ballWorldPos = ballObject.position.clone();
  const localBallPos = batObject.worldToLocal(ballWorldPos.clone());
  
  // 2. Find closest point on the bat's AABB to the ball's center
  const closestPointLocal = new THREE.Vector3().copy(localBallPos).clamp(batLocalBox.min, batLocalBox.max);
  
  // 3. Distance check for OBB vs Sphere intersection
  const effectiveRadius = BALL_RADIUS * physicsSettings.hitboxMultiplier;
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
  
  // Edge detection: local X mapped to [-1, 1]
  const edgeFactor = Math.max(-1, Math.min(1, closestPointLocal.x / 0.25));
  
  // Bat Face Normal (Bat face is -Z in local space)
  const localNormal = new THREE.Vector3(0, 0, -1);
  const worldFaceNormal = localNormal.applyQuaternion(batObject.quaternion).normalize();
  
  // Bat Swing Velocity at contact point
  // V = W x R
  const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(batObject.quaternion).normalize();
  // Multiply by the actual height of the contact point to simulate lever mechanics
  const batContactVelocity = batAngularVelocity.clone().cross(upVector).multiplyScalar(closestPointLocal.y);
  
  // Ball Reflection Physics
  let d = incomingBallVelocity.clone();
  if (d.lengthSq() < 0.001) d.set(0, 0, 1);
  d.normalize();
  
  const n = worldFaceNormal;
  // r = d - 2(d · n)n
  const dot = d.dot(n);
  const r = d.clone().sub(n.clone().multiplyScalar(2 * dot)).normalize();
  
  // Add swing velocity contribution
  // We blend reflection and bat velocity for a physical feel
  const swingContribution = batContactVelocity.clone().multiplyScalar(0.25);
  let finalDirection = r.add(swingContribution);
  
  // Shot Height (Loft System)
  const verticalLift = worldFaceNormal.y;
  finalDirection.y += verticalLift * 0.8; // Map vertical face normal to lift
  
  // Edge Hit Behavior
  const absEdge = Math.abs(edgeFactor);
  let powerMultiplier = 1.0;
  if (absEdge > 0.4) {
    // reduce power on edges, mitigated by edgeForgiveness
    const penalty = (absEdge - 0.4) * (1.0 - physicsSettings.edgeForgiveness);
    powerMultiplier = Math.max(0.3, 1.0 - penalty); 
    // Add randomness based on edge
    finalDirection.x += edgeFactor * (0.2 + Math.random() * 0.3);
    finalDirection.z += (Math.random() - 0.5) * 0.2;
  }
  
  finalDirection.normalize();
  
  // Power Scaling
  const baseSpeed = 10;
  const maxExtraSpeed = 50;
  // Scale final velocity
  const speed = (baseSpeed + (maxExtraSpeed * swingPower * powerMultiplier)) * physicsSettings.powerBoost;
  const finalVelocity = finalDirection.multiplyScalar(speed);
  
  // Determine shot type string for UI
  let shotType = "Drive";
  if (verticalLift > 0.3) shotType = "Lofted " + shotType;
  if (edgeFactor > 0.4) shotType = "Edge (Right)";
  else if (edgeFactor < -0.4) shotType = "Edge (Left)";
  else if (Math.abs(finalDirection.x) > 0.5) shotType = finalDirection.x > 0 ? "Cut" : "Pull";
  
  return {
    velocity: finalVelocity,
    isEdge: absEdge > 0.4,
    powerPct: Math.round(swingPower * powerMultiplier * 100),
    hitPosition: hitPositionOnBat,
    shotType: shotType
  };
}

export function applyBallVelocity(ballObject, velocity, dt) {
  ballObject.position.addScaledVector(velocity, dt);
  velocity.y -= 9.8 * 2 * dt; // Gravity
  
  // Simple bounce
  if (ballObject.position.y <= 0.2) {
    ballObject.position.y = 0.2;
    velocity.y *= -0.35; // Reduced bounce (was -0.6 or -0.4)
    velocity.x *= 0.95; // Friction
    velocity.z *= 0.95;
  }
}
