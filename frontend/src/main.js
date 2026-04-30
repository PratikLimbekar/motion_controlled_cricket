import { setupScene, updateBallPosition, resetBall } from './scene/setupScene.js';
import { connectSocket } from './network/socket.js';
import { addMotionData, getRecentMotion } from './input/motionBuffer.js';
import { detectBatBallContact, computeShotFromContact, applyBallVelocity } from './gameplay/physics.js';
import { initFielders, onBallLanded, updateFieldersEndOfOver, updateFielderChasing, resetFielderStates, lerpFieldersToBase } from './gameplay/FielderSystem.js';
import { config } from './config.js';
import * as THREE from 'three';

/* ================================
   🎯 TUNING PARAMETERS
================================ */
// All tuning parameters are now in config.js

/* ================================
   🧠 MOTION STATE VARIABLES
================================ */

// Smoothed gravity vector (low-pass filtered)
let gravityVec = new THREE.Vector3(0, 0, 0);

// Current orientation of the phone (tracked via gyro integration)
let currentOrientation = new THREE.Quaternion().identity();

// Calibration offset (used to "zero" orientation without snapping)
let calibrationQuaternion = new THREE.Quaternion().identity();

let rawOrientation = new THREE.Quaternion().identity();
let currentWorldAngularVelocity = new THREE.Vector3();
let currentSwingPower = 0;

/* ================================
   🎮 GAME STATE
================================ */

let isBallActive = false;
let isBallHit = false;
let ballHasBouncedAfterHit = false;
let shotHistoryAngles = []; // Store angles of last 2 shots in radians
let ballVelocity = new THREE.Vector3(0, 0, 0);
let ballPositionZ = config.environment.ballStartPosZ;
let ballTrail = []; // Array of {x, z}
let firstBouncePos = null; // {x, z}
let lastTime = performance.now();

// Cinematic Camera States
const CAMERA_MODES = {
  BATSMAN: 'batsman',
  FOLLOW_BALL: 'follow_ball'
};
let currentCameraMode = CAMERA_MODES.BATSMAN;
let cameraTargetPos = new THREE.Vector3(config.cameraSettings.batsmanCamPos.x, config.cameraSettings.batsmanCamPos.y, config.cameraSettings.batsmanCamPos.z);
let cameraLookAtTarget = new THREE.Vector3(config.cameraSettings.batsmanLookAt.x, config.cameraSettings.batsmanLookAt.y, config.cameraSettings.batsmanLookAt.z);

// Hit Feedback
let contactFlash = null;

let runState = {
  hitStartTime: 0,
  isRunning: false,
  runnerProgress: 0.0,
  runsAttempted: 0,
  targetRuns: -1,
  isThrowing: false,
  throwAnimationTime: 0,
  throwTotalTime: 0,
  fielderPos: null
};

const indianXI = [
  "Rohit Sharma", "Shubman Gill", "Virat Kohli", "Shreyas Iyer", 
  "KL Rahul", "Hardik Pandya", "Ravindra Jadeja", "Axar Patel", 
  "Kuldeep Yadav", "Jasprit Bumrah", "Mohammed Siraj"
];

let matchState = {
  totalRuns: 0,
  wickets: 0,
  balls: 0,
  strikerIndex: 0,
  nonStrikerIndex: 1,
  strikerRuns: 0,
  strikerBalls: 0,
  nonStrikerRuns: 0,
  nonStrikerBalls: 0
};

function updateMatchState(runsScored, isWicket = false) {
  matchState.balls++;
  
  if (isWicket) {
    matchState.wickets++;
    matchState.strikerIndex = Math.max(matchState.strikerIndex, matchState.nonStrikerIndex) + 1;
    if (matchState.strikerIndex > 10) matchState.strikerIndex = 10; // All out bounds check
    matchState.strikerRuns = 0; // new batsman
    matchState.strikerBalls = 0;
  } else {
    matchState.totalRuns += runsScored;
    matchState.strikerRuns += runsScored;
  }
  
  matchState.strikerBalls++;
  
  if (runsScored % 2 !== 0) {
    // Rotate strike
    let tempR = matchState.strikerRuns;
    let tempB = matchState.strikerBalls;
    let tempI = matchState.strikerIndex;
    matchState.strikerRuns = matchState.nonStrikerRuns;
    matchState.strikerBalls = matchState.nonStrikerBalls;
    matchState.strikerIndex = matchState.nonStrikerIndex;
    matchState.nonStrikerRuns = tempR;
    matchState.nonStrikerBalls = tempB;
    matchState.nonStrikerIndex = tempI;
  }
  
  // End of over rotation
  if (matchState.balls % 6 === 0) {
    let tempR = matchState.strikerRuns;
    let tempB = matchState.strikerBalls;
    let tempI = matchState.strikerIndex;
    matchState.strikerRuns = matchState.nonStrikerRuns;
    matchState.strikerBalls = matchState.nonStrikerBalls;
    matchState.strikerIndex = matchState.nonStrikerIndex;
    matchState.nonStrikerRuns = tempR;
    matchState.nonStrikerBalls = tempB;
    matchState.nonStrikerIndex = tempI;
    
    // AI UPDATE AT END OF OVER
    updateFieldersEndOfOver(matchState.balls / 6);
  }
  
  const overs = Math.floor(matchState.balls / 6);
  const legalBalls = matchState.balls % 6;
  
  const crr = matchState.balls > 0 ? (matchState.totalRuns / (matchState.balls / 6)).toFixed(2) : "0.00";
  
  document.getElementById('scoreText').innerText = `${matchState.totalRuns}/${matchState.wickets}`;
  document.getElementById('oversText').innerText = `${overs}.${legalBalls}`;
  document.getElementById('crrText').innerText = crr;
  
  const strikerName = config.indianXI[matchState.strikerIndex];
  const nonStrikerName = config.indianXI[matchState.nonStrikerIndex];
  
  document.getElementById('strikerText').innerText = `▶ ${strikerName}: ${matchState.strikerRuns} (${matchState.strikerBalls})`;
  document.getElementById('nonStrikerText').innerText = `   ${nonStrikerName}: ${matchState.nonStrikerRuns} (${matchState.nonStrikerBalls})`;
  
  let lastRunsText = runsScored.toString();
  if (runsScored === 6) lastRunsText += " (SIX!)";
  if (runsScored === 4) lastRunsText += " (FOUR!)";
  document.getElementById('lastRuns').innerText = lastRunsText;
}

let deliverySpeed = 15;
let deliverySwingX = 0;
let deliverySpinX = 0;
let deliveryPitchZ = -10;

let ballObject = null;
let batObject = null;
let bounceMarkerObject = null;

// Where bat naturally rests when idle (centralized in config.environment)
const restPosition = new THREE.Vector3(config.environment.restPosition.x, config.environment.restPosition.y, config.environment.restPosition.z);

/* ================================
   🚀 INIT FUNCTION
================================ */

function init() {
  const { scene, camera, renderer, bat, ball, bounceMarker, fielders: sceneFielders } = setupScene(document.getElementById('app'));

  ballObject = ball;
  batObject = bat;
  bounceMarkerObject = bounceMarker;
  
  // Impact Feedback
  contactFlash = new THREE.PointLight(0xffff00, 0, 10);
  scene.add(contactFlash);

  let fielders = sceneFielders;
  initFielders(fielders);

  /* ================================
     📡 SOCKET INPUT (REAL-TIME SENSOR DATA)
  ================================= */

  connectSocket((data) => {
    if (data.type === 'action' && data.action === 'next_ball') {
      console.log("Game: NEXT BALL action received");
      launchBall();
      return;
    }

    if (data.type !== 'motion') return;

    const rawAccArr = data.data.acc;
    const rawGyro = data.data.gyro.map(v => Math.abs(v) < config.GYRO_DEADZONE ? 0 : v);

    // Keep buffered data for swing detection logic
    addMotionData(rawAccArr, rawGyro);

    if (!batObject) return;

    /* ================================
       🧠 1. CONVERT RAW INPUTS
    ================================= */

    const rawAcc = new THREE.Vector3(...rawAccArr);

    /* ================================
       🌍 2. GRAVITY ISOLATION
    ================================= */

    const alpha = 0.95;
    gravityVec.lerp(rawAcc, 1 - alpha);

    /* ================================
       ⚡ 3. LINEAR ACCELERATION
    ================================= */

    const linearAcc = rawAcc.clone().sub(gravityVec);

    /* ================================
       🔄 4. GYRO → ORIENTATION
    ================================= */

    const SENSOR_DT = 0.02;

    const deltaQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        rawGyro[0] * config.ROTATION_SENSITIVITY * SENSOR_DT,
        rawGyro[1] * config.ROTATION_SENSITIVITY * SENSOR_DT,
        rawGyro[2] * config.ROTATION_SENSITIVITY * SENSOR_DT,
        'XYZ'
      )
    );

    // Raw (no correction)
    rawOrientation.multiply(deltaQuat);

    // Corrected (for visuals)
    currentOrientation.multiply(deltaQuat);
    currentOrientation.normalize();

    /* ================================
       🧭 5. DRIFT CORRECTION
    ================================= */

    const gravityDir = gravityVec.clone().normalize();
    const expectedDown = new THREE.Vector3(0, 1, 0);

    const correctionQuat = new THREE.Quaternion().setFromUnitVectors(
      gravityDir,
      expectedDown
    );

    // currentOrientation.slerp(correctionQuat, 0.005);

    /* ================================
       🎯 6. APPLY CALIBRATION
    ================================= */

    batObject.quaternion.copy(calibrationQuaternion).multiply(currentOrientation);

    /* ================================
       🌍 7. DEVICE → WORLD TRANSFORMATION
    ================================= */

    const worldAcc = linearAcc.clone().applyQuaternion(batObject.quaternion);

    /* ================================
       🏏 8. SWING TRANSLATION
    ================================= */

    // Main swing arc
    const gyroVec = new THREE.Vector3(...rawGyro);
    const angularSpeed = gyroVec.length();

    currentWorldAngularVelocity.copy(gyroVec).applyQuaternion(batObject.quaternion);
    const currentAccMag = rawAcc.length();
    currentSwingPower = Math.max(0, Math.min(1, currentAccMag / config.MAX_EXPECTED_ACC));

    if (angularSpeed > 0.01) {
      // 🔥 USE RAW ORIENTATION (no gravity interference)
  const forward = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(rawOrientation)
    .normalize();

  const right = new THREE.Vector3(1, 0, 0)
    .applyQuaternion(rawOrientation)
    .normalize();

  const up = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(rawOrientation)
    .normalize();

  // Map motion properly
  batObject.position.add(forward.multiplyScalar(gyroVec.z * 0.004));
  batObject.position.add(right.multiplyScalar(gyroVec.y * 0.003));
  batObject.position.add(up.multiplyScalar(gyroVec.x * 0.002));
    }

    // Fine movement
    batObject.position.add(worldAcc.multiplyScalar(config.POSITION_SCALE * 0.5));

    /* ================================
       🎯 9. SWING DETECTION (MOVED TO PHYSICS LOOP)
    ================================= */
  });

  /* ================================
     ⌨️ INPUT CONTROLS
  ================================= */

  let launchTimeout = null;

  function launchBall() {
    // console.log("launchBall called.");
    if (launchTimeout) clearTimeout(launchTimeout);
    
    // Instantly reset state so it can be interrupted
    isBallActive = false;
    isBallHit = false;
    ballHasBouncedAfterHit = false;
    currentCameraMode = CAMERA_MODES.BATSMAN;
    
    runState.isRunning = false;
    runState.runnerProgress = 0.0;
    runState.runsAttempted = 0;
    runState.targetRuns = -1;
    runState.isThrowing = false;
    runState.throwAnimationTime = 0;
    const pip = document.getElementById('pipMinimap');
    if (pip) pip.style.display = 'none';
    
    ballTrail = [];
    firstBouncePos = null;
    
    resetFielderStates();
    resetBall(ballObject);
    if (bounceMarkerObject) bounceMarkerObject.visible = false;
    
    document.getElementById('shotResult').innerText = "Get Ready... (1.5s)";
    document.getElementById('shotResult').style.color = "cyan";

    calibrationQuaternion.copy(currentOrientation).invert();
    batObject.position.copy(restPosition);

    launchTimeout = setTimeout(() => {
      isBallActive = true;
      isBallHit = false;
      ballHasBouncedAfterHit = false;
      ballVelocity.set(0, 0, 0);
      ballPositionZ = config.environment.ballStartPosZ;
      
      // Randomize delivery
      deliverySpeed = config.deliverySettings.baseSpeed + Math.random() * config.deliverySettings.speedVariance;
      deliveryPitchZ = config.deliverySettings.pitchZMin + Math.random() * (config.deliverySettings.pitchZMax - config.deliverySettings.pitchZMin);
      
      // Calculate where the ball should pitch on the X axis
      const targetPitchX = config.deliverySettings.pitchXMin + Math.random() * (config.deliverySettings.pitchXMax - config.deliverySettings.pitchXMin);
      const timeToReachPitch = (deliveryPitchZ - config.environment.ballStartPosZ) / deliverySpeed;
      
      // Calculate the required horizontal velocity (swing) to reach that X position
      deliverySwingX = targetPitchX / timeToReachPitch;
      deliverySpinX = (Math.random() - 0.5) * 2 * config.deliverySettings.spinXMax;

      // Position and show bounce marker at the predicted pitch point
      const markerX = targetPitchX;
      if (bounceMarkerObject) {
        bounceMarkerObject.position.set(markerX, 0.03, deliveryPitchZ);
        bounceMarkerObject.visible = true;
        bounceMarkerObject.material.opacity = 0.85;
      }

      resetBall(ballObject);
      document.getElementById('shotResult').innerText = "Delivery!";
      document.getElementById('shotResult').style.color = "white";
    }, 1500);
  }

  document.addEventListener('keydown', (e) => {

    if (e.code === 'Space') {
      launchBall();
    }

    if (e.code === 'KeyR') {
      calibrationQuaternion.copy(currentOrientation).invert();

      const el = document.getElementById('shotResult');
      el.innerText = 'Recalibrated!';
      el.style.color = 'cyan';

      setTimeout(() => { el.innerText = ''; }, 1000);
    }
  });

  // Tap to bowl
  document.addEventListener('pointerdown', (e) => {
    // Ignore clicks on UI elements like buttons if they exist
    if (e.target.tagName !== 'BUTTON') {
      launchBall();
    }
  });

  /* ================================
     📍 PIP MINIMAP RENDERER
  ================================= */
  function drawRunnersPiP() {
    const canvas = document.getElementById('pipMinimap');
    if (!canvas || canvas.style.display === 'none') return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw pitch line
    ctx.beginPath();
    ctx.moveTo(20, 30);
    ctx.lineTo(180, 30);
    ctx.strokeStyle = '#D2B48C';
    ctx.lineWidth = 15;
    ctx.stroke();
    
    // Crease lines
    ctx.beginPath();
    ctx.moveTo(20, 15); ctx.lineTo(20, 45);
    ctx.moveTo(180, 15); ctx.lineTo(180, 45);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Runners
    const isOdd = runState.runsAttempted % 2 === 0;
    let sPos = isOdd ? 20 + runState.runnerProgress * 160 : 180 - runState.runnerProgress * 160;
    let nPos = isOdd ? 180 - runState.runnerProgress * 160 : 20 + runState.runnerProgress * 160;
    
    ctx.fillStyle = 'cyan';
    ctx.beginPath(); ctx.arc(sPos, 25, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'orange';
    ctx.beginPath(); ctx.arc(nPos, 35, 4, 0, Math.PI * 2); ctx.fill();
    
    // Text
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`${runState.runsAttempted} Runs`, 80, 15);
  }

  /* ================================
     📍 MINIMAP RENDERER
  ================================= */
  
  function drawMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scale = (canvas.width / 2) / (config.BOUNDARY_R * 1.1); // Dynamic scale for circular field
    
    // Boundary (Circular)
    ctx.beginPath();
    ctx.arc(cx, cy, config.BOUNDARY_R * scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 30-yard circle (Oval)
    ctx.beginPath();
    ctx.ellipse(cx, cy, config.INFIELD_R * config.INFIELD_SCALE_X * scale, config.INFIELD_R * config.INFIELD_SCALE_Z * scale, 0, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Pitch
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(cx - 2 * scale, cy - 8 * scale, 4 * scale, 24 * scale); // centered around -8 in Z
    
    // Ball Trail
    if (ballTrail.length > 1) {
       ctx.beginPath();
       ctx.setLineDash([2, 2]);
       ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
       const start = ballTrail[0];
       ctx.moveTo(cx + start.x * scale, cy + start.z * scale);
       for (let i = 1; i < ballTrail.length; i++) {
          ctx.lineTo(cx + ballTrail[i].x * scale, cy + ballTrail[i].z * scale);
       }
       ctx.stroke();
       ctx.setLineDash([]);
    }

    // First Bounce Position (Red X)
    if (firstBouncePos) {
       const bx = cx + firstBouncePos.x * scale;
       const bz = cy + firstBouncePos.z * scale;
       const size = 5;
       ctx.beginPath();
       ctx.strokeStyle = 'red';
       ctx.lineWidth = 2;
       ctx.moveTo(bx - size, bz - size);
       ctx.lineTo(bx + size, bz + size);
       ctx.moveTo(bx + size, bz - size);
       ctx.lineTo(bx - size, bz + size);
       ctx.stroke();
    }

    // Ball
    if (ballObject && (isBallActive || isBallHit)) {
       const bx = cx + ballObject.position.x * scale;
       const by = cy + ballObject.position.z * scale;
       ctx.beginPath();
       ctx.arc(bx, by, 4, 0, Math.PI * 2);
       ctx.fillStyle = 'yellow';
       ctx.fill();
    }
    
    // Fielders
    ctx.fillStyle = 'blue';
    for (let f of fielders) {
       const fx = cx + f.position.x * scale;
       const fz = cy + f.position.z * scale;
       ctx.beginPath();
       ctx.arc(fx, fz, 3, 0, Math.PI * 2);
       ctx.fill();
    }
  }

  /* ================================
     🎬 RENDER LOOP
  ================================= */

  function animate(time) {
    requestAnimationFrame(animate);

    const dt = (time - lastTime) / 1000 || 0;
    lastTime = time;

    /* ⚾ BALL PHYSICS */

    if (isBallActive) {
      ballPositionZ += deliverySpeed * dt;

      if (ballPositionZ > 8) { // Deactivate later so late swings aren't practice swings
        isBallActive = false;
        document.getElementById('shotResult').innerText = "Missed the ball!";
        updateMatchState(0);
      } else {
        ballObject.position.z = ballPositionZ;
        
        // Bowled logic (Updated for new stump position)
        if (ballPositionZ >= config.stumpSettings.posZ_striker - 0.2 && ballPositionZ < config.stumpSettings.posZ_striker + 0.4 && 
            Math.abs(ballObject.position.x) < config.physics.bowledXThreshold && ballObject.position.y < config.physics.bowledYThreshold) {
            isBallActive = false;
            document.getElementById('shotResult').innerText = "BOWLED!";
            document.getElementById('shotResult').style.color = "red";
            updateMatchState(0, true);
            return;
        }
        
        // Smooth parabolic bounce — ball pitches once at deliveryPitchZ
        const releaseHeight = config.environment.releaseHeight;
        const groundHeight = config.environment.groundHeight;
        const battingHeight = config.environment.battingHeight;
        
        if (ballPositionZ < deliveryPitchZ) {
          // Approach arc: smooth drop using a quadratic ease-in
          const t = (ballPositionZ - config.environment.ballStartPosZ) / (deliveryPitchZ - config.environment.ballStartPosZ); // 0→1
          ballObject.position.y = releaseHeight + (groundHeight - releaseHeight) * (t * t);
          ballObject.position.x += deliverySwingX * dt; // swing applies before pitch
        } else {
          // Rise arc: smooth rise using a quadratic ease-out
          const t = (ballPositionZ - deliveryPitchZ) / (6 - deliveryPitchZ); // 0→1
          const tClamped = Math.min(t, 1);
          ballObject.position.y = groundHeight + (battingHeight - groundHeight) * (1 - (1 - tClamped) * (1 - tClamped));
          
          // Apply spin (sudden change in horizontal drift) instead of swing
          ballObject.position.x += deliverySpinX * dt;

          // Fade out bounce marker as ball rises after pitching
          if (bounceMarkerObject && bounceMarkerObject.visible) {
            bounceMarkerObject.material.opacity -= 3 * dt;
            if (bounceMarkerObject.material.opacity <= 0) {
              bounceMarkerObject.visible = false;
            }
          }
        }

        // PHYSICS COLLISION CHECK
        if (batObject && ballPositionZ > -5 && ballPositionZ < 5) {
          const contactInfo = detectBatBallContact(batObject, ballObject);
          if (contactInfo.isContact) {
            isBallHit = true;
            isBallActive = false;
            
            runState.hitStartTime = performance.now();
            runState.isRunning = true; // Start running immediately
            runState.runnerProgress = 0.0;
            runState.runsAttempted = 0;
            runState.targetRuns = -1;
            runState.isThrowing = false;
            runState.throwAnimationTime = 0;
            const pip = document.getElementById('pipMinimap');
            if (pip) pip.style.display = 'block';
            
            const incomingVelocity = new THREE.Vector3(deliverySwingX, 0, deliverySpeed);
            const shot = computeShotFromContact(contactInfo, batObject, incomingVelocity, currentWorldAngularVelocity, currentSwingPower);
            
            ballVelocity.copy(shot.velocity);
            
            // IMPACT FEEDBACK & CAMERA
            contactFlash.position.copy(contactInfo.ballWorldPos);
            contactFlash.intensity = 15;
            currentCameraMode = CAMERA_MODES.FOLLOW_BALL;

            if (shot.isEdge) {
               const originalColor = ballObject.material.color.getHex();
               ballObject.material.color.setHex(0xffff00);
               setTimeout(() => {
                 if (ballObject) ballObject.material.color.setHex(originalColor);
               }, 150);
            }
            
            document.getElementById('shotResult').innerText = `Shot! (${shot.shotType})`;
            document.getElementById('shotResult').style.color = shot.isEdge ? "orange" : "white";
          }
        }
      }
    } else if (isBallHit) {
      applyBallVelocity(ballObject, ballVelocity, dt);
      
      const isAirborne = !ballHasBouncedAfterHit;
      
      // Grace period for bounce: Ball must have travelled some distance from hit point 
      const timeSinceHit = performance.now() - runState.hitStartTime;
      if (ballObject.position.y <= config.environment.groundHeight + 0.05 && isAirborne && timeSinceHit > config.physics.hitGracePeriod) {
         ballHasBouncedAfterHit = true;
         firstBouncePos = { x: ballObject.position.x, z: ballObject.position.z };
         onBallLanded(ballObject.position, Math.floor(matchState.balls / 6));
      }
      
      // Update trail
      if (ballTrail.length === 0 || ballObject.position.distanceTo(new THREE.Vector3(ballTrail[ballTrail.length-1].x, ballObject.position.y, ballTrail[ballTrail.length-1].z)) > 1) {
         ballTrail.push({ x: ballObject.position.x, z: ballObject.position.z });
      }
      
      // BOUNDARY LOGIC (Circular check)
      const distSq = ballObject.position.x * ballObject.position.x + ballObject.position.z * ballObject.position.z;
      const dist = Math.sqrt(distSq);
      
      if (dist >= config.BOUNDARY_R - 0.5) {
         let runs = 4;
         if (!ballHasBouncedAfterHit) { 
            runs = 6;
            onBallLanded(ballObject.position, Math.floor(matchState.balls / 6));
         }
         isBallHit = false;
         runState.isRunning = false;
         runState.isThrowing = false;
         const pip = document.getElementById('pipMinimap');
         if (pip) pip.style.display = 'none';
         
         updateMatchState(runs);
         document.getElementById('shotResult').innerText = runs === 6 ? "SIX!" : "FOUR!";
         document.getElementById('shotResult').style.color = "lightgreen";
      } else {
         // Runners are already active from hit moment

         const fieldedResult = updateFielderChasing(dt, ballObject, ballVelocity, isAirborne);
          if (fieldedResult.isGathering) ballVelocity.set(0, 0, 0);
         
         if (fieldedResult.fielded) {
               if (fieldedResult.caught) {
                   // CATCH!
                   isBallHit = false;
                   runState.isRunning = false;
                   updateMatchState(0, true);
                   document.getElementById('shotResult').innerText = `OUT! Caught by ${fieldedResult.fielderName}`;
                   document.getElementById('shotResult').style.color = "red";
                  const pip = document.getElementById('pipMinimap');
                  if (pip) pip.style.display = 'none';
              } else if (!runState.isThrowing) {
                  // Ball is fielded - stop hit physics and start throwing
                  isBallHit = false;
                  runState.isThrowing = true;
                  runState.isRunning = false; 
                  runState.targetRuns = runState.runsAttempted; 
                  
                  runState.fielderPos = ballObject.position.clone();
                  // Faster throw speed (dividing by 1.8 to reduce animation duration)
                  const throwTime = (dist / config.FIELDER_SPEED) / 1.8; 
                  
                  runState.throwAnimationTime = throwTime;
                  runState.throwTotalTime = throwTime;
              }
         }
      }
    } else {
      // Return fielders to base when ball is inactive
      lerpFieldersToBase(dt);
    }

    /* 🪶 POSITION DAMPING */

    if (batObject) {
      batObject.position.lerp(restPosition, config.RETURN_DAMPING);
    }
    
    // Per-Frame Running Simulation (Batsmen Movement)
    if (runState.isRunning || runState.isThrowing) {
       const baseRunTime = config.PITCH_LENGTH / config.RUNNER_SPEED; 
       const runSpeed = dt / baseRunTime;
       const shouldReturn = runState.isThrowing;
       
       if (shouldReturn) {
          if (runState.runnerProgress > 0) {
             runState.runnerProgress = Math.max(0, runState.runnerProgress - (runSpeed * 4.0)); // Return to crease quickly
          }
       } else {
          runState.runnerProgress += runSpeed;
          if (runState.runnerProgress >= 1.0) {
             runState.runnerProgress = 0.0;
             runState.runsAttempted++;
          }
       }
       
       
       if (runState.isThrowing) {
          runState.throwAnimationTime -= dt;
          
          if (runState.throwTotalTime > 0) {
              const t = Math.max(0, 1.0 - (runState.throwAnimationTime / runState.throwTotalTime));
              const stumpsPos = new THREE.Vector3(0, 0.5, config.stumpSettings.posZ_striker);
              ballObject.position.lerpVectors(runState.fielderPos, stumpsPos, t);
              ballObject.position.y = 0.5 + Math.sin(t * Math.PI) * 2; // parabolic arc
          }
          
          if (runState.throwAnimationTime <= 0) {
              const hasReturned = runState.runnerProgress <= 0.01;
              if (hasReturned) {
                 updateMatchState(runState.targetRuns);
                 document.getElementById('shotResult').innerText = runState.targetRuns > 0 ? `${runState.targetRuns} Runs` : "Dot Ball";
                 document.getElementById('shotResult').style.color = "white";
                 
                 runState.isRunning = false;
                 runState.isThrowing = false;
                 const pip = document.getElementById('pipMinimap');
                 if (pip) pip.style.display = 'none';
              }
           }
       }
       drawRunnersPiP();
    }
    
    drawMinimap();

    // Dynamic Camera System
    if (currentCameraMode === CAMERA_MODES.BATSMAN) {
       cameraTargetPos.set(config.cameraSettings.batsmanCamPos.x, config.cameraSettings.batsmanCamPos.y, config.cameraSettings.batsmanCamPos.z);
       cameraLookAtTarget.lerp(new THREE.Vector3(config.cameraSettings.batsmanLookAt.x, config.cameraSettings.batsmanLookAt.y, config.cameraSettings.batsmanLookAt.z), 0.1);
    } else if (currentCameraMode === CAMERA_MODES.FOLLOW_BALL) {
       const ballPos = ballObject.position;
       const s = config.cameraSettings;
       
       // Calculate loft intensity (0 to 1) based on ball height
       const loftIntensity = Math.min(1.0, Math.max(0, (ballPos.y - 0.5) / 8.0));
       const dynamicDistance = s.followDistance * (1.0 + loftIntensity * (s.loftFactor - 1.0));
       const dynamicHeight = s.followHeight * (1.0 + loftIntensity * (s.loftFactor - 1.0));

       // Maintain a follow position behind the ball relative to its travel
       cameraTargetPos.lerp(new THREE.Vector3(ballPos.x, ballPos.y + dynamicHeight, ballPos.z + dynamicDistance), s.lerpSpeed);
       cameraLookAtTarget.lerp(ballPos, s.lookAtLerp);
    }
    
    const camLerpSpeed = currentCameraMode === CAMERA_MODES.BATSMAN ? 0.05 : config.cameraSettings.lerpSpeed;
    camera.position.lerp(cameraTargetPos, camLerpSpeed);
    camera.lookAt(cameraLookAtTarget);

    // Fade Flash
    if (contactFlash && contactFlash.intensity > 0) {
       contactFlash.intensity *= 0.85;
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
}

/* ================================
   🚀 START APP
================================ */

init();
