# Step-by-Step: Bat-Ball Contact & Shot Direction Simulation

## Overview

The goal of this document is to describe how to move from the current heuristic-based hit detection ("is the ball within Z range?") to a true spatial bat-ball contact system, and how to derive a physically meaningful shot direction and height from that contact.

---

## Phase A: True Bat-Ball Contact Detection

### Step 1: Define the Bat's Collision Zone

The bat is a 3D mesh (a `BoxGeometry`). Instead of treating it as a point, define a "sweet spot" — a 3D bounding region that moves with the bat every frame.

**What to implement:**
- Add a `hitBox` to the bat object (a `THREE.Box3`) that updates every frame using `bat.getWorldPosition()` and the bat's current rotation.
- Alternatively, use a dedicated invisible child mesh at the blade center as a proxy collider.

```js
// In animate() each frame:
const batBox = new THREE.Box3().setFromObject(batMesh); // batMesh = blade mesh

// Ball collider
const ballSphere = new THREE.Sphere(ballObject.position, 0.2);

if (batBox.intersectsSphere(ballSphere) && isBallActive) {
  // CONTACT DETECTED
}
```

**Why this matters:** Current logic uses `ballPositionZ` only — a 1D check. True contact detection is 3D, meaning a swing that completely misses the ball spatially registers as a miss even if the timing was "correct."

---

### Step 2: Register Contact Only During Active Swing

A contact must happen during an intentional swing, not when the bat is passively in the path of the ball. Actually not true, 
if the bat isin path of ball, contact must be registered. power of swing should decide how far the ball travel.

**Filter logic:**
- Only register contact if the bat has a current angular velocity above a threshold (i.e., the player is actually swinging, not just holding the bat in front of the ball).
- You already compute `angularSpeed` in `main.js` — expose this value and check it at collision time.

```js
if (batBox.intersectsSphere(ballSphere) && isBallActive) {
  // VALID HIT
}
```

---

### Step 3: Compute Contact Point Relative to the Bat

Once contact is detected, find the contact point on the bat's surface. This determines whether the shot is a clean center hit or an edge.

```js
// Project the ball's position onto the bat's local space
const batLocalBallPos = batObject.worldToLocal(ballObject.position.clone());

// Normalized position on bat blade: -1 = bottom edge, 0 = center, +1 = top edge
const hitPositionOnBat = batLocalBallPos.y / (batBladeHeight / 2); // clamp -1 to 1
```

- **Center hit (|hitPositionOnBat| < 0.3)**: Full power, clean trajectory
- **Edge hit (|hitPositionOnBat| > 0.6)**: Reduced power, more random deviation (edge/mis-hit)

---

## Phase B: Deriving Shot Direction from Contact

### Step 4: Compute Bat Face Normal at Contact

The bat face normal tells us which direction the bat is "pointing" at the moment of impact. This is the primary determinant of the shot direction.

```js
// The bat blade faces -Z locally in our setup
const localFaceNormal = new THREE.Vector3(0, 0, -1);

// Transform to world space using bat's world rotation
const worldFaceNormal = localFaceNormal.clone().applyQuaternion(batObject.quaternion).normalize();
```

This `worldFaceNormal` is the most important vector — it describes the plane the bat is presenting to the ball.

---

### Step 5: Compute Bat Swing Velocity Vector

The bat velocity at the moment of contact determines how much force is applied to the ball and in what direction.

```js
// gyroVec from swingDetector at peak frame
const batAngularVelocity = new THREE.Vector3(...peakFrame.rawGyro);

// The swing velocity at the blade tip = angular velocity × blade length (lever arm)
const bladeLength = 1.5; // meters (approximate)
const batTipVelocity = batAngularVelocity.clone().cross(new THREE.Vector3(0, 1, 0)).multiplyScalar(bladeLength);
```

---

### Step 6: Calculate the Reflected Ball Direction

The outgoing ball direction is calculated using physics reflection — the ball "bounces" off the bat face depending on:
1. The bat face normal (direction the bat is presented)
2. The bat's swing velocity (adds momentum to the ball)

```js
// Ball incoming direction (from bowler toward player = positive Z)
const incomingDir = new THREE.Vector3(0, 0, 1).normalize();

// Reflection: r = d - 2(d · n)n
const dotProduct = incomingDir.dot(worldFaceNormal);
const reflectedDir = incomingDir.clone().sub(
  worldFaceNormal.clone().multiplyScalar(2 * dotProduct)
).normalize();

// Add swing contribution (bat velocity adds momentum)
const finalDir = reflectedDir.clone().add(batTipVelocity.clone().multiplyScalar(0.3)).normalize();
```

---

### Step 7: Compute Shot Height from Bat Angle

The vertical angle of the bat face at contact determines whether the ball goes along the ground (drive) or high into the air (loft).

```js
// Extract the vertical component of the face normal
const verticalLift = worldFaceNormal.y;

// Map to speed components:
// verticalLift > 0.4 = significant loft (high shot)
// verticalLift < 0.1 = flat/drive (low, fast)
const yVelocity  = 5 + (verticalLift * 20);  // 5 = minimum bounce, 20 = max loft
const zVelocity  = finalDir.z * speed;
const xVelocity  = finalDir.x * speed;
```

---

### Step 8: Scale Speed by Swing Power

Power is already computed in `swingDetector.js` as a 0–1 value. Apply it:

```js
const speed = 25 + (35 * power); // 25 base + 35 at full power

ballVelocity.set(
  xVelocity * speed,
  yVelocity,
  zVelocity * speed
);
```

---

## Phase C: Mis-hits & Edge Detection

### Step 9: Apply Deviation for Edge Hits

If `hitPositionOnBat` is far from center (an edge), reduce power and add random lateral deviation:

```js
if (Math.abs(hitPositionOnBat) > 0.6) {
  // Edge hit
  const edgeFactor = 1 - Math.abs(hitPositionOnBat); // 0.4 at extreme edge
  const deviation = (Math.random() - 0.5) * 10;

  ballVelocity.x += deviation;
  ballVelocity.multiplyScalar(edgeFactor);

  resultEl.innerText = "Edge!";
}
```

---

## Summary: Implementation Order

| Step | What to Build | File |
|---|---|---|
| 1 | Bat `THREE.Box3` collider, updated every frame | `main.js` / `setupScene.js` |
| 2 | Gate contact on `angularSpeed > threshold` | `main.js` |
| 3 | Compute `hitPositionOnBat` in bat local space | `main.js` |
| 4 | Extract `worldFaceNormal` from bat quaternion | `main.js` |
| 5 | Compute `batTipVelocity` from gyro at peak | `main.js` / `swingDetector.js` |
| 6 | Apply reflection formula to get `finalDir` | `main.js` |
| 7 | Map `verticalLift` to Y-velocity | `main.js` |
| 8 | Scale all velocity by swing power | `main.js` |
| 9 | Add edge-hit randomness for off-center contact | `main.js` |

---

## Important Note on Current Architecture

The current system uses `detectSwing()` which polls the **motion buffer** — it has ~130ms of latency by design (the buffer exists to smooth noise). When moving to collision-based detection, contact must be detected **immediately in the render loop** (not via the buffer). The buffer should only be used to qualify *whether* the bat is currently in an active swing.







- add a bowler and a wicket keeper. The bowler can change sides on the pitch randomly, and the ball comes from the bowler after the run up is done, and not randomly from top of the stumps. Ensure that the wicket keeper is behind the bat and the stumps and that each return throw from the fielder is returned to the wicket keeper. 
- ensure that there are 11 fielders on the field. Update mini map to show them (including bowler and wicket keeper).
- add a loft shot and a stroke shot button on the mobile app, that on click will result in a lofted shot by the user. Ensure that these buttons are in a clickable zone while playing. Move the disconnect button to the top right corner. add a small Scorecard button at the bottom left corner. Reduce power of shots that aren't stroke or loft. Make it so that stroke shots are along the ground and lofted shots go in the air, based on their timings. Ensure that only one of them can be toggled at a time, and provided visual feedback of which of them is toggled to the user on the screen.
- create a roster of 10 teams and their playing XI. create a UI as per the reference image provided. Use the Roster to fetch names of teams, players and bowlers dynamically. No static names. Currently default to India as the user's playing team. 
- Show dynamic scorecard upon clicking button from mobile or hitting S. Make it disappear on another click of same button. 
- Grab the last five players of each team from the roster. These are your bowlers. Show them on the scorebar at the bottom and also take note of the runs they have gone for, the wickets they have taken and the overs they have bowled. Show this in the scorecard as well. Ensure that each bowler can bowl only 4 overs per match. 
- Move the running between wickets pip from bottom to top of the screen, as it will overlay on the scorecard.