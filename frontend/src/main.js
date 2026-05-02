import { setupScene, updateBallPosition, resetBall } from './scene/setupScene.js';
import { connectSocket } from './network/socket.js';
import { addMotionData, getRecentMotion } from './input/motionBuffer.js';
import { detectBatBallContact, computeShotFromContact, applyBallVelocity } from './gameplay/physics.js';
import { 
  initFielders, 
  onBallLanded, 
  updateFieldersEndOfOver, 
  updateFielderChasing, 
  resetFielderStates, 
  lerpFieldersToBase,
  startBowlerRunUp,
  updateBowlerRunUp,
  getBowlerReleaseX,
  getWicketkeeperPosition,
  getBowlerObject,
  getWicketkeeperObject
} from './gameplay/FielderSystem.js';
import { config } from './config.js';
import { ROSTER, getTeam, getBowlers } from './data/Roster.js';
import * as THREE from 'three';

/* ================================
   🧠 GAME STATE & MATCH DATA
================================ */

let userTeam = null;
let opponentTeam = null;
let currentBowlerIndex = 0; // Index within the 5 specialists
let bowlerStats = []; // { name, overs, runs, wickets }

let isMatchStarted = false;
let isBallActive = false;
let isBallHit = false;
let ballHasBouncedAfterHit = false;
let ballVelocity = new THREE.Vector3(0, 0, 0);
let ballPositionZ = config.environment.ballStartPosZ;
let ballTrail = []; 
let firstBouncePos = null;
let lastTime = performance.now();

// Shot Modes
let shotMode = 'none'; // 'none', 'loft', 'stroke'

// Cinematic Camera States
const CAMERA_MODES = { BATSMAN: 'batsman', FOLLOW_BALL: 'follow_ball' };
let currentCameraMode = CAMERA_MODES.BATSMAN;
let cameraTargetPos = new THREE.Vector3();
let cameraLookAtTarget = new THREE.Vector3();

let runState = {
  hitStartTime: 0,
  isRunning: false,
  runnerProgress: 0.0,
  runsAttempted: 0,
  targetRuns: -1,
  isThrowing: false,
  throwAnimationTime: 0,
  throwTotalTime: 0,
  fielderPos: null,
  targetPos: null // Wicketkeeper or Bowler end
};

let matchState = {
  totalRuns: 0,
  wickets: 0,
  balls: 0,
  strikerIndex: 0,
  nonStrikerIndex: 1,
  strikerRuns: 0,
  strikerBalls: 0,
  nonStrikerRuns: 0,
  nonStrikerBalls: 0,
  battingOrder: [], // Players of userTeam
  oversBowled: 0,
  inningsBalls: 0,
  target: 0,
  overHistory: []
};

// Player Stats for Scorecard
let batsmenStats = []; // { name, runs, balls, fours, sixes, status }

/* ================================
   🚀 INITIALIZATION & UI
================================ */

const { scene, camera, renderer, bat, ball, bounceMarker, fielders, bowler: bowlerModel, wicketkeeper: wkModel } = setupScene(document.getElementById('app'));
let batObject = bat;
let ballObject = ball;
let bounceMarkerObject = bounceMarker;
let contactFlash = new THREE.PointLight(0xffff00, 0, 10);
scene.add(contactFlash);

const restPosition = new THREE.Vector3(config.environment.restPosition.x, config.environment.restPosition.y, config.environment.restPosition.z);
let gravityVec = new THREE.Vector3(0, 0, 0);
let currentOrientation = new THREE.Quaternion().identity();
let calibrationQuaternion = new THREE.Quaternion().identity();
let rawOrientation = new THREE.Quaternion().identity();
let currentWorldAngularVelocity = new THREE.Vector3();
let currentSwingPower = 0;

function initMatch(userTeamId, oppId) {
  userTeam = getTeam(userTeamId); 
  opponentTeam = getTeam(oppId);
  
  // Setup specialists
  const specialists = getBowlers(opponentTeam.id);
  bowlerStats = specialists.map(p => ({ name: p.name, overs: 0, runs: 0, wickets: 0, balls: 0 }));
  
  // Setup target: 110 to 240 runs
  matchState.target = 110 + Math.floor(Math.random() * 131);
  matchState.overHistory = [];
  document.getElementById('sb-target-score').innerText = matchState.target;
  
  // Setup batsmen
  matchState.battingOrder = userTeam.players.map(p => p.name);
  batsmenStats = userTeam.players.map(p => ({ name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, status: 'not out' }));
  
  // Update UI Initial
  document.getElementById('sb-bat-flag').innerText = userTeam.flagEmoji;
  document.getElementById('sb-bat-short').innerText = userTeam.shortName;
  document.getElementById('sb-bat-team-name').innerText = userTeam.name.toUpperCase();
  document.getElementById('sb-bowl-team-name').innerText = opponentTeam.shortName.toUpperCase();
  
  updateUIScorebar();
  
  initFielders(fielders, bowlerModel, wkModel);
  isMatchStarted = true;
  document.getElementById('teamSelectModal').style.display = 'none';
  document.getElementById('gameUI').style.display = 'block';
  
  // Set team colors for all fielders, bowler and keeper
  const oppColor = new THREE.Color(opponentTeam.color);
  if (bowlerModel) bowlerModel.children[0].material.color.copy(oppColor);
  if (wkModel) wkModel.children[0].material.color.copy(oppColor);
  fielders.forEach(f => {
    if (f.children[0]) f.children[0].material.color.copy(oppColor);
  });
}

function updateUIScorebar() {
  if (!isMatchStarted) return;
  
  const striker = batsmenStats[matchState.strikerIndex];
  const nstriker = batsmenStats[matchState.nonStrikerIndex];
  const currentBowler = bowlerStats[currentBowlerIndex];
  
  document.getElementById('sb-striker-name').innerText = striker.name;
  document.getElementById('sb-striker-runs').innerText = striker.runs;
  document.getElementById('sb-striker-balls').innerText = `(${striker.balls})`;
  
  document.getElementById('sb-nstriker-name').innerText = nstriker.name;
  document.getElementById('sb-nstriker-runs').innerText = nstriker.runs;
  document.getElementById('sb-nstriker-balls').innerText = `(${nstriker.balls})`;
  
  document.getElementById('sb-score').innerText = `${matchState.totalRuns}/${matchState.wickets}`;
  const overs = Math.floor(matchState.inningsBalls / 6);
  const balls = matchState.inningsBalls % 6;
  const crr = matchState.inningsBalls > 0 ? (matchState.totalRuns / (matchState.inningsBalls / 6)).toFixed(2) : "0.00";
  document.getElementById('sb-overs-crr').innerText = `${overs}.${balls} ov · CRR ${crr}`;
  
  document.getElementById('sb-bowler-name').innerText = currentBowler.name.toUpperCase();
  
  // Render Over History
  const historyContainer = document.getElementById('sb-over-history');
  if (historyContainer) {
    historyContainer.innerHTML = '';
    matchState.overHistory.forEach(ball => {
      const icon = document.createElement('span');
      icon.className = 'ball-icon';
      if (ball.isWicket) icon.classList.add('wicket');
      else if (ball.runs >= 4) icon.classList.add('boundary');
      icon.innerText = ball.label;
      historyContainer.appendChild(icon);
    });
  }

  // Update Target Needs
  const runsNeeded = Math.max(0, matchState.target - matchState.totalRuns);
  const totalInningsBalls = 120; // 20 Overs
  const ballsLeft = Math.max(0, totalInningsBalls - matchState.inningsBalls);
  const needStats = document.getElementById('sb-need-stats');
  if (needStats) {
    if (runsNeeded <= 0) {
      needStats.innerText = "TARGET REACHED";
      needStats.style.color = "#4FC3F7";
    } else if (ballsLeft <= 0) {
      needStats.innerText = "INNINGS OVER";
      needStats.style.color = "#FF5252";
    } else {
      needStats.innerText = `NEED ${runsNeeded} FROM ${ballsLeft}`;
      needStats.style.color = "rgba(255,255,255,0.6)";
    }
  }
}

/** Utility to show a big message in the center for a brief moment */
let contactDiagramTimer = null;
function showContactDiagram(x, y) {
  const container = document.getElementById('contactDiagram');
  const canvas = document.getElementById('impactCanvas');
  const ctx = canvas.getContext('2d');
  
  clearTimeout(contactDiagramTimer);
  container.style.display = 'flex';
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const w = 36; // Blade width
  const h = 75; // Blade height
  const ox = (canvas.width - w) / 2;
  const oy = 20; // Start of blade (shoulders)
  
  // 1. Draw Bat Blade with Curves
  ctx.beginPath();
  ctx.moveTo(ox + 4, oy); // Left shoulder inner
  ctx.bezierCurveTo(ox, oy, ox, oy + 5, ox, oy + 10); // Shoulder curve
  ctx.lineTo(ox, oy + h - 10); // Left edge
  ctx.bezierCurveTo(ox, oy + h, ox + w, oy + h, ox + w, oy + h - 10); // Rounded Toe
  ctx.lineTo(ox + w, oy + 10); // Right edge
  ctx.bezierCurveTo(ox + w, oy + 5, ox + w, oy, ox + w - 4, oy); // Right shoulder curve
  ctx.closePath();
  
  // Fill with wood-like gradient
  const grad = ctx.createLinearGradient(ox, oy, ox + w, oy);
  grad.addColorStop(0, '#D2B48C');
  grad.addColorStop(0.5, '#E6C9A8');
  grad.addColorStop(1, '#D2B48C');
  ctx.fillStyle = grad;
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // 2. Draw Handle
  const hX = canvas.width / 2 - 4;
  const hW = 8;
  const hH = 20;
  
  ctx.fillStyle = '#333'; // Grip color
  ctx.fillRect(hX, 0, hW, hH);
  
  // Grip texture (lines)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for(let i=2; i<hH; i+=4) {
    ctx.beginPath(); ctx.moveTo(hX, i); ctx.lineTo(hX+hW, i); ctx.stroke();
  }

  // 3. Impact point (x, y are normalized -1 to 1)
  // Mapping logic flipped to match user perspective:
  // x: -1 is now mirrored (account for bat facing away vs UI facing towards)
  // y: -1 (toe) to 1 (shoulders)
  const px = ox + (1 - (x + 1) * 0.5) * w; // FLIPPED X
  const py = oy + ((y + 1) * 0.5) * h;    // FLIPPED Y (0 is top/shoulders, h is bottom/toe)
  
  // Impact Glow
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#FF5252';
  ctx.fillStyle = '#FF5252';
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner white core for the dot
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 2, 0, Math.PI * 2);
  ctx.fill();

  contactDiagramTimer = setTimeout(() => {
    container.style.display = 'none';
  }, 2000);
}

function showBriefMessage(text, color = "#fff") {
  const overlay = document.getElementById('shotResult');
  overlay.innerText = text;
  overlay.style.color = color;
  overlay.style.opacity = "1";
  overlay.style.transform = "translate(-50%, -50%) scale(1)";
  
  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.style.transform = "translate(-50%, -50%) scale(0.8)";
  }, 1200);
}

function updateScorecard() {
  const batBody = document.getElementById('sc-batting-body');
  const bowlBody = document.getElementById('sc-bowling-body');
  
  batBody.innerHTML = '';
  batsmenStats.forEach((p, i) => {
    const isStriker = i === matchState.strikerIndex;
    const isNStriker = i === matchState.nonStrikerIndex;
    const sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : "0.0";
    const row = document.createElement('tr');
    if (isStriker || isNStriker) row.className = 'batting-active';
    row.innerHTML = `
      <td>${isStriker ? '▶ ' : ''}${p.name}</td>
      <td>${p.runs}</td><td>${p.balls}</td><td>${p.fours}</td><td>${p.sixes}</td><td>${sr}</td><td>${p.status}</td>
    `;
    batBody.appendChild(row);
  });
  
  bowlBody.innerHTML = '';
  bowlerStats.forEach((p) => {
    const bOvers = Math.floor(p.balls / 6);
    const bBalls = p.balls % 6;
    const eco = p.balls > 0 ? (p.runs / (p.balls / 6)).toFixed(2) : "0.00";
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.name}</td>
      <td>${bOvers}.${bBalls}</td><td>${p.runs}</td><td>${p.wickets}</td><td>${eco}</td>
    `;
    bowlBody.appendChild(row);
  });
  
  document.getElementById('sc-innings-score').innerText = `${matchState.totalRuns}/${matchState.wickets} (${Math.floor(matchState.inningsBalls / 6)}.${matchState.inningsBalls % 6})`;
}

function toggleScorecard() {
  const sc = document.getElementById('scorecardOverlay');
  if (sc.classList.contains('visible')) {
    sc.classList.remove('visible');
  } else {
    updateScorecard();
    sc.classList.add('visible');
  }
}

/* ================================
   🎯 BATTING & PHYSICS
================================ */

function updateMatchState(runsScored, isWicket = false) {
  matchState.inningsBalls++;
  const striker = batsmenStats[matchState.strikerIndex];
  const bowler = bowlerStats[currentBowlerIndex];
  
  striker.balls++;
  bowler.balls++;
  
  if (isWicket) {
    matchState.wickets++;
    bowler.wickets++;
    striker.status = 'caught';
    matchState.strikerIndex = Math.max(matchState.strikerIndex, matchState.nonStrikerIndex) + 1;
    if (matchState.strikerIndex >= 11) matchState.strikerIndex = 10; 
  } else {
    matchState.totalRuns += runsScored;
    striker.runs += runsScored;
    bowler.runs += runsScored;
    if (runsScored === 4) { striker.fours++; showBriefMessage("FOUR!", "#4CAF50"); }
    else if (runsScored === 6) { striker.sixes++; showBriefMessage("SIX!", "#4CAF50"); }
    else if (runsScored > 0) showBriefMessage(`${runsScored} RUNS`, "#FFF");
    else showBriefMessage("DOT BALL", "#90A4AE");
  }
  
  // Track ball in over history
  const ballLabel = isWicket ? 'W' : runsScored;
  matchState.overHistory.push({ label: ballLabel, runs: runsScored, isWicket });
  
  if (runsScored % 2 !== 0) {
    let temp = matchState.strikerIndex;
    matchState.strikerIndex = matchState.nonStrikerIndex;
    matchState.nonStrikerIndex = temp;
  }
  
  // Over end
  if (matchState.inningsBalls % 6 === 0) {
    matchState.overHistory = []; // Reset history for new over
    let temp = matchState.strikerIndex;
    matchState.strikerIndex = matchState.nonStrikerIndex;
    matchState.nonStrikerIndex = temp;
    
    // Change bowler
    currentBowlerIndex = (currentBowlerIndex + 1) % 5;
    updateFieldersEndOfOver(matchState.inningsBalls / 6);
  }
  
  updateUIScorebar();
  
  const lb = document.getElementById('sb-last-ball-badge');
  lb.innerText = isWicket ? 'W' : runsScored;
  lb.style.background = runsScored === 4 || runsScored === 6 ? '#43A047' : (isWicket ? '#D32F2F' : 'rgba(255,255,255,0.1)');

  // Hide contact diagram when ball is dead
  document.getElementById('contactDiagram').style.display = 'none';
}

function launchBall() {
  if (isBallActive || runState.isRunning || runState.isThrowing) return;
  
  isBallActive = false;
  isBallHit = false;
  ballHasBouncedAfterHit = false;
  currentCameraMode = CAMERA_MODES.BATSMAN;
  
  resetFielderStates();
  resetBall(ballObject);
  firstBouncePos = null;
  
  document.getElementById('status').innerText = ""; // Hide "Bowler is running in..." from corner

  calibrationQuaternion.copy(currentOrientation).invert();
  batObject.position.copy(restPosition);

  startBowlerRunUp(config.bowlerSettings.runUpDuration);
  
  // Bowler classification logic
  const currentBowler = getBowlers(opponentTeam.id)[currentBowlerIndex];
  const isSpinner = currentBowler.bowlType === 'spin';

  // Spinners have more speed variation
  let speed = config.deliverySettings.baseSpeed + (Math.random() - 0.5) * 2 * config.deliverySettings.speedVariance;
  if (isSpinner) {
    // Spinners: 70% to 85% of base speed
    speed = config.deliverySettings.baseSpeed * (0.70 + Math.random() * 0.15);
  }

  const pitchZ = config.deliverySettings.pitchZMin + Math.random() * (config.deliverySettings.pitchZMax - config.deliverySettings.pitchZMin);
  
  // Keep targetX strictly within the pitch width (approx -1.2 to 1.2)
  let targetX = config.deliverySettings.pitchXMin + Math.random() * (config.deliverySettings.pitchXMax - config.deliverySettings.pitchXMin);
  targetX = Math.max(-1.1, Math.min(1.1, targetX));
  
  const releaseZ = config.bowlerSettings.releaseZ;
  const timeToPitch = (pitchZ - releaseZ) / speed;
  const releaseX = getBowlerReleaseX();
  
  // Calculate swing and spin
  let swingX = (targetX - releaseX) / timeToPitch;
  let spinX = 0;
  
  if (!isSpinner) {
    // Pacers swing *towards* the target but might deviate slightly
    const randomSwing = (Math.random() - 0.5) * 2 * 0.8; 
    swingX += randomSwing;
  } else {
    // Normalizing speed to get a factor (lower speed = higher factor)
    const speedFactor = (config.deliverySettings.baseSpeed * 0.75) / speed; 
    const baseTurn = 3.0 + Math.random() * 2.5;
    spinX = (Math.random() > 0.5 ? 1 : -1) * baseTurn * speedFactor;
  }

  // RE-CALCULATE ACTUAL PITCH POINT based on the final swingX
  const actualPitchX = releaseX + swingX * timeToPitch;
  
  ballObject.userData.delivery = { speed, pitchZ, targetX: actualPitchX, swingX, spinX, isSpinner, releaseX };

  if (bounceMarkerObject) {
    // Place marker at the REAL calculated pitch point
    bounceMarkerObject.position.set(actualPitchX, 0.03, pitchZ);
    bounceMarkerObject.visible = true;
    bounceMarkerObject.material.opacity = 0.85;
  }

  setTimeout(() => {
    isBallActive = true;
    ballPositionZ = releaseZ;
    // Use the exact same releaseX that was used for calculations
    ballObject.position.x = releaseX; 
  }, config.bowlerSettings.runUpDuration * 1000);
}

/* ================================
   📡 NETWORK & INPUT
================================ */

connectSocket((data) => {
  if (data.type === 'action') {
    if (data.action === 'next_ball') launchBall();
    if (data.action === 'toggle_scorecard') toggleScorecard();
    if (data.action === 'set_shot_mode') {
      // Correcting reversed mapping from mobile app
      if (data.mode === 'loft') shotMode = 'stroke';
      else if (data.mode === 'stroke') shotMode = 'loft';
      else shotMode = data.mode;
      
      const indicator = document.getElementById('shotModeIndicator');
      const label = document.getElementById('modeLabel');
      if (shotMode === 'none') {
        indicator.style.display = 'none';
      } else {
        indicator.style.display = 'flex';
        label.innerText = shotMode.toUpperCase();
        document.getElementById('modeDot').style.background = shotMode === 'loft' ? '#FF5252' : '#4CAF50';
      }
    }
    return;
  }

  if (data.type !== 'motion') return;
  addMotionData(data.data.acc, data.data.gyro.map(v => Math.abs(v) < config.GYRO_DEADZONE ? 0 : v));
  
  if (!batObject) return;
  const rawAccArr = data.data.acc;
  const rawGyro = data.data.gyro;
  const rawAcc = new THREE.Vector3(...rawAccArr);
  const alpha = 0.95;
  gravityVec.lerp(rawAcc, 1 - alpha);
  const linearAcc = rawAcc.clone().sub(gravityVec);
  const SENSOR_DT = 0.02;
  const deltaQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    rawGyro[0] * config.ROTATION_SENSITIVITY * SENSOR_DT,
    rawGyro[1] * config.ROTATION_SENSITIVITY * SENSOR_DT,
    rawGyro[2] * config.ROTATION_SENSITIVITY * SENSOR_DT,
    'XYZ'
  ));
  rawOrientation.multiply(deltaQuat);
  currentOrientation.multiply(deltaQuat).normalize();
  batObject.quaternion.copy(calibrationQuaternion).multiply(currentOrientation);
  const worldAcc = linearAcc.clone().applyQuaternion(batObject.quaternion);
  const gyroVec = new THREE.Vector3(...rawGyro);
  const angularSpeed = gyroVec.length();
  currentWorldAngularVelocity.copy(gyroVec).applyQuaternion(batObject.quaternion);
  currentSwingPower = Math.max(0, Math.min(1, rawAcc.length() / config.MAX_EXPECTED_ACC));

  if (angularSpeed > 0.01) {
    const fwd = new THREE.Vector3(0,0,1).applyQuaternion(rawOrientation).normalize();
    const rgt = new THREE.Vector3(1,0,0).applyQuaternion(rawOrientation).normalize();
    const up = new THREE.Vector3(0,1,0).applyQuaternion(rawOrientation).normalize();
    batObject.position.add(fwd.multiplyScalar(gyroVec.z * 0.004));
    batObject.position.add(rgt.multiplyScalar(gyroVec.y * 0.003));
    batObject.position.add(up.multiplyScalar(gyroVec.x * 0.002));
  }
  batObject.position.add(worldAcc.multiplyScalar(config.POSITION_SCALE * 0.5));
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') launchBall();
  if (e.code === 'KeyS') toggleScorecard();
  if (e.code === 'KeyR') calibrationQuaternion.copy(currentOrientation).invert();
});

/* ================================
   📍 MINIMAP RENDERER
================================ */

function drawMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const scale = (canvas.width / 2) / (config.BOUNDARY_R * 1.1);
  
  ctx.beginPath(); ctx.arc(cx, cy, config.BOUNDARY_R * scale, 0, Math.PI * 2);
  ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
  
  ctx.beginPath(); ctx.ellipse(cx, cy, config.INFIELD_R * config.INFIELD_SCALE_X * scale, config.INFIELD_R * config.INFIELD_SCALE_Z * scale, 0, 0, Math.PI * 2);
  ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke(); ctx.setLineDash([]);
  
  ctx.fillStyle = '#D2B48C'; ctx.fillRect(cx - 2 * scale, cy - 8 * scale, 4 * scale, 24 * scale);

  // Players
  const drawDot = (pos, color, size = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx + pos.x * scale, cy + pos.z * scale, size, 0, Math.PI * 2); ctx.fill();
  };

  fielders.forEach(f => drawDot(f.position, '#4FC3F7', 2.5));
  const bObj = getBowlerObject(); if (bObj) drawDot(bObj.position, '#FF5252', 3);
  const wkObj = getWicketkeeperObject(); if (wkObj) drawDot(wkObj.position, '#FFEB3B', 3);

  // Draw first bounce 'X' marker
  if (firstBouncePos) {
    const bx = cx + firstBouncePos.x * scale;
    const bz = cy + firstBouncePos.z * scale;
    ctx.strokeStyle = '#FFD54F'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 4, bz - 4); ctx.lineTo(bx + 4, bz + 4);
    ctx.moveTo(bx + 4, bz - 4); ctx.lineTo(bx - 4, bz + 4);
    ctx.stroke();
  }

  if (isBallActive || isBallHit) drawDot(ballObject.position, '#FFFF00', 3.5);
}

function drawRunnersPiP() {
  const canvas = document.getElementById('pipMinimap');
  if (canvas.style.display === 'none') return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#D2B48C'; ctx.fillRect(20, 26, 180, 10);
  ctx.strokeStyle = 'white'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 18); ctx.lineTo(20, 44); ctx.moveTo(200, 18); ctx.lineTo(200, 44); ctx.stroke();
  
  const isOdd = runState.runsAttempted % 2 === 0;
  let sPos = isOdd ? 20 + runState.runnerProgress * 180 : 200 - runState.runnerProgress * 180;
  let nPos = isOdd ? 200 - runState.runnerProgress * 180 : 20 + runState.runnerProgress * 180;
  
  ctx.fillStyle = '#4FC3F7'; ctx.beginPath(); ctx.arc(sPos, 22, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFB74D'; ctx.beginPath(); ctx.arc(nPos, 38, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 12px Rajdhani'; ctx.textAlign = 'center';
  ctx.fillText(`${runState.runsAttempted} RUNS`, 110, 14);
}

/* ================================
   🎬 RENDER LOOP
================================ */

function animate(time) {
  requestAnimationFrame(animate);
  const dt = (time - lastTime) / 1000 || 0;
  lastTime = time;

  updateBowlerRunUp(dt);

  if (isBallActive) {
    const d = ballObject.userData.delivery;
    ballPositionZ += d.speed * dt;
    ballObject.position.z = ballPositionZ;

    if (ballPositionZ > 8) {
      isBallActive = false;
      updateMatchState(0);
    } else {
      const releaseZ = config.bowlerSettings.releaseZ;
      const releaseX = d.releaseX || 0; // Ensure we have releaseX

      if (ballPositionZ < d.pitchZ) {
        const t = (ballPositionZ - releaseZ) / (d.pitchZ - releaseZ);
        ballObject.position.y = config.environment.releaseHeight + (config.environment.groundHeight - config.environment.releaseHeight) * (t * t);
        // Absolute X calculation for accuracy
        ballObject.position.x = releaseX + d.swingX * ((ballPositionZ - releaseZ) / d.speed);
      } else {
        const t = Math.min(1, (ballPositionZ - d.pitchZ) / (6 - d.pitchZ));
        ballObject.position.y = config.environment.groundHeight + (config.environment.battingHeight - config.environment.groundHeight) * (1 - (1-t)*(1-t));
        
        // Absolute X calculation for accuracy including spin
        const timeSincePitch = (ballPositionZ - d.pitchZ) / d.speed;
        ballObject.position.x = (releaseX + d.swingX * ((d.pitchZ - releaseZ) / d.speed)) + (d.spinX * timeSincePitch);
        
        if (bounceMarkerObject.visible) {
          bounceMarkerObject.material.opacity -= 3 * dt;
          if (bounceMarkerObject.material.opacity <= 0) bounceMarkerObject.visible = false;
        }
      }

      // Bowled check
      if (ballPositionZ >= config.stumpSettings.posZ_striker - 0.2 && ballPositionZ < config.stumpSettings.posZ_striker + 0.4 && 
          Math.abs(ballObject.position.x) < config.physics.bowledXThreshold && ballObject.position.y < config.physics.bowledYThreshold) {
          isBallActive = false;
          showBriefMessage("BOWLED!", "#FF5252");
          updateMatchState(0, true);
          return;
      }

      // Hit detection
      if (batObject && ballPositionZ > -5 && ballPositionZ < 5) {
        const contact = detectBatBallContact(batObject, ballObject);
        if (contact.isContact) {
          isBallHit = true; isBallActive = false;
          runState.hitStartTime = performance.now();
          runState.isRunning = true; runState.runnerProgress = 0; runState.runsAttempted = 0;
          document.getElementById('pipMinimap').style.display = 'block';
          
          const incomingVel = new THREE.Vector3(d.swingX, 0, d.speed);
          const shot = computeShotFromContact(contact, batObject, incomingVel, currentWorldAngularVelocity, currentSwingPower);
          
          // Show Impact Diagram
          showContactDiagram(shot.edgeFactor, shot.hitPosition);

          // Apply shot mode modifiers
          let pwr = shotMode === 'none' ? config.shotSettings.defaultPowerPenalty : 1.0;
          if (shotMode === 'stroke') {
            // Force strictly ground shots: zero vertical lift, slightly downward
            shot.velocity.y = Math.min(shot.velocity.y, -0.05); 
            pwr *= config.shotSettings.strokeSpeedBonus;
          } else if (shotMode === 'loft') {
            shot.velocity.y += config.shotSettings.loftLiftBonus;
            shot.velocity.y = Math.max(shot.velocity.y, config.shotSettings.loftMinY);
          } else {
            // Default (no mode): very flat
            shot.velocity.y = Math.min(shot.velocity.y, 0.15);
            shot.velocity.y *= 0.4;
          }
          
          ballVelocity.copy(shot.velocity).multiplyScalar(pwr);
          contactFlash.position.copy(contact.ballWorldPos); contactFlash.intensity = 15;
          currentCameraMode = CAMERA_MODES.FOLLOW_BALL;
          
          if (shot.isEdge) showBriefMessage("EDGED!", "#FFD54F");
        }
      }
    }
  } else if (isBallHit) {
    const justBounced = applyBallVelocity(ballObject, ballVelocity, dt);
    const isAirborne = !ballHasBouncedAfterHit;
    
    if (isAirborne && justBounced && (performance.now() - runState.hitStartTime) > config.physics.hitGracePeriod) {
       ballHasBouncedAfterHit = true;
       firstBouncePos = ballObject.position.clone();
       onBallLanded(ballObject.position, Math.floor(matchState.inningsBalls / 6));
    }
    
    const dist = Math.sqrt(ballObject.position.x**2 + ballObject.position.z**2);
    if (dist >= config.BOUNDARY_R - 0.5) {
       let runs = ballHasBouncedAfterHit ? 4 : 6;
       isBallHit = false; runState.isRunning = false; runState.isThrowing = false;
       document.getElementById('pipMinimap').style.display = 'none';
       updateMatchState(runs);
    } else {
       const fieldRes = updateFielderChasing(dt, ballObject, ballVelocity, isAirborne);
       if (fieldRes.isGathering) ballVelocity.set(0, 0, 0);
       if (fieldRes.fielded) {
          if (fieldRes.caught) {
             isBallHit = false; runState.isRunning = false;
             showBriefMessage("OUT! CAUGHT", "#FF5252");
             updateMatchState(0, true);
             document.getElementById('pipMinimap').style.display = 'none';
          } else if (!runState.isThrowing) {
             isBallHit = false; runState.isThrowing = true; runState.isRunning = false;
             
             // Runners run to the closest end
             if (runState.runnerProgress > 0.5) {
                // More than halfway, complete this run
                runState.targetRuns = runState.runsAttempted + 1;
                runState.targetProgress = 1.0;
             } else {
                // Less than halfway, run back
                runState.targetRuns = runState.runsAttempted;
                runState.targetProgress = 0.0;
             }
             
             runState.fielderPos = ballObject.position.clone();
             runState.targetPos = getWicketkeeperPosition();
             runState.throwTotalTime = (runState.fielderPos.distanceTo(runState.targetPos) / config.FIELDER_SPEED) / 1.5;
             runState.throwAnimationTime = runState.throwTotalTime;
          }
       }
    }
  } else {
    lerpFieldersToBase(dt);
  }

  if (batObject) batObject.position.lerp(restPosition, config.RETURN_DAMPING);

  if (runState.isRunning || runState.isThrowing) {
    const runSpeed = dt / (config.PITCH_LENGTH / config.RUNNER_SPEED);
    if (runState.isThrowing) {
      // Run to the target progress (0 or 1)
      if (Math.abs(runState.runnerProgress - runState.targetProgress) > 0.01) {
        const dir = runState.targetProgress > runState.runnerProgress ? 1 : -1;
        runState.runnerProgress += dir * runSpeed * 3; // Sprint to the end
        runState.runnerProgress = Math.max(0, Math.min(1, runState.runnerProgress));
      }
      
      runState.throwAnimationTime -= dt;
      const t = 1.0 - Math.max(0, runState.throwAnimationTime / runState.throwTotalTime);
      ballObject.position.lerpVectors(runState.fielderPos, runState.targetPos, t);
      ballObject.position.y = 0.5 + Math.sin(t * Math.PI) * 2;
      
      if (runState.throwAnimationTime <= 0 && Math.abs(runState.runnerProgress - runState.targetProgress) <= 0.02) {
        updateMatchState(runState.targetRuns);
        runState.isThrowing = false;
        document.getElementById('pipMinimap').style.display = 'none';
      }
    } else {
      runState.runnerProgress += runSpeed;
      if (runState.runnerProgress >= 1.0) { runState.runnerProgress = 0; runState.runsAttempted++; }
    }
    drawRunnersPiP();
  }

  drawMinimap();

  // Camera
  if (currentCameraMode === CAMERA_MODES.BATSMAN) {
    cameraTargetPos.set(config.cameraSettings.batsmanCamPos.x, config.cameraSettings.batsmanCamPos.y, config.cameraSettings.batsmanCamPos.z);
    cameraLookAtTarget.lerp(new THREE.Vector3(config.cameraSettings.batsmanLookAt.x, config.cameraSettings.batsmanLookAt.y, config.cameraSettings.batsmanLookAt.z), 0.1);
  } else {
    const b = ballObject.position;
    const s = config.cameraSettings;
    const loft = Math.min(1, Math.max(0, (b.y - 0.5)/8));
    const dist = s.followDistance * (1 + loft*(s.loftFactor-1));
    cameraTargetPos.lerp(new THREE.Vector3(b.x, b.y + s.followHeight*(1 + loft*(s.loftFactor-1)), b.z + dist), s.lerpSpeed);
    cameraLookAtTarget.lerp(b, s.lookAtLerp);
  }
  camera.position.lerp(cameraTargetPos, currentCameraMode === CAMERA_MODES.BATSMAN ? 0.05 : config.cameraSettings.lerpSpeed);
  camera.lookAt(cameraLookAtTarget);
  if (contactFlash.intensity > 0) contactFlash.intensity *= 0.85;
  renderer.render(scene, camera);
}

// ─── Team Select Logic ───────────────────────────────────────────────────
let selectedUserTeamId = 'india';
let selectedOppTeamId = 'australia';

function setupTeamSelect() {
  const userGrid = document.getElementById('userTeamGrid');
  const oppGrid = document.getElementById('opponentGrid');
  
  ROSTER.teams.forEach(t => {
    // User Team Selection
    const uBtn = document.createElement('div');
    uBtn.className = 'opp-btn' + (t.id === selectedUserTeamId ? ' selected' : '');
    uBtn.innerHTML = `<span class="opp-flag">${t.flagEmoji}</span><span>${t.name.toUpperCase()}</span>`;
    uBtn.onclick = () => {
      userGrid.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('selected'));
      uBtn.classList.add('selected');
      selectedUserTeamId = t.id;
    };
    userGrid.appendChild(uBtn);

    // Opponent Team Selection
    const oBtn = document.createElement('div');
    oBtn.className = 'opp-btn' + (t.id === selectedOppTeamId ? ' selected' : '');
    oBtn.innerHTML = `<span class="opp-flag">${t.flagEmoji}</span><span>${t.name.toUpperCase()}</span>`;
    oBtn.onclick = () => {
      oppGrid.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('selected'));
      oBtn.classList.add('selected');
      selectedOppTeamId = t.id;
    };
    oppGrid.appendChild(oBtn);
  });

  const startBtn = document.getElementById('startMatchBtn');
  startBtn.onclick = () => {
    if (selectedUserTeamId === selectedOppTeamId) {
      alert("Please choose different teams!");
      return;
    }
    initMatch(selectedUserTeamId, selectedOppTeamId);
  };
}

setupTeamSelect();
requestAnimationFrame(animate);
