import { setupScene, updateBallPosition, resetBall } from './scene/setupScene.js';
import { connectSocket } from './network/socket.js';
import { addMotionData, getRecentMotion } from './input/motionBuffer.js';
import { detectBatBallContact, computeShotFromContact, applyBallVelocity } from './gameplay/physics.js';
import { 
  initFielders, startBowlerRunUp, updateBowlerRunUp, getBowlerReleaseX, 
  getWicketkeeperPosition, updateFielderChasing, resetFielderStates, 
  lerpFieldersToBase, updateFieldersEndOfOver, getBowlerObject, 
  getWicketkeeperObject, setFormat, onBallLanded
} from './gameplay/FielderSystem.js';
import { config } from './config.js';
import { ROSTER, getTeam, getBowlers } from './data/Roster.js';
import { IPL_ROSTER, getIPLTeam } from './data/IPLRoster.js';
import { DOMESTIC_ROSTER, getDomesticTeam, getDomesticBowlers } from './data/DomesticRoster.js';
import { tournament } from './data/TournamentState.js';
import { career } from './data/CareerState.js';
import { SCENARIOS } from './data/Scenarios.js';
import * as THREE from 'three';
import { OptionalCameraController } from './ai/OptionalCameraController.js';

/* ================================
   🧠 GAME STATE & MATCH DATA
================================ */

let userTeam = null;
let opponentTeam = null;
let currentBowlerIndex = 0; // Index within the 5 specialists
let bowlerStats = []; // { name, overs, runs, wickets }
let isTournamentMode = false;
let isCareerMode = false;
let currentScenario = null;
let userBattingIndex = 0; // The index of the user in batsmenStats

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
  overHistory: [],
  overRunsStart: 0,   // total runs at start of current over (for end-of-over runs count)
};

// Wagon Wheel data: array of { x, z, runs, batterIndex }
let wagonWheelData = [];
let wagonWheelVisible = false;
let wagonWheelTab = -1; // -1 = team, else batterIndex

// Player Stats for Scorecard
let batsmenStats = []; // { name, runs, balls, fours, sixes, status }

/* ================================
   🚀 INITIALIZATION & UI
================================ */

const sceneUtils = setupScene(document.getElementById('app'));
const { scene, camera, renderer, bat, ball, bounceMarker, guardMarker, fielders, bowler: bowlerModel, wicketkeeper: wkModel } = sceneUtils;
let batObject = bat;
let ballObject = ball;
let bounceMarkerObject = bounceMarker;
let guardMarkerObject = guardMarker;
let contactFlash = new THREE.PointLight(0xffff00, 0, 10);
scene.add(contactFlash);

// 🎯 Performance: cap pixel ratio to 1 — biggest single GPU win
renderer.setPixelRatio(1);
// Re-apply size so the cap takes effect
renderer.setSize(window.innerWidth, window.innerHeight);

let gravityVec = new THREE.Vector3(0, 0, 0);
let currentOrientation = new THREE.Quaternion().identity();
let calibrationQuaternion = new THREE.Quaternion().identity();
let rawOrientation = new THREE.Quaternion().identity();
let currentWorldAngularVelocity = new THREE.Vector3();
let currentSwingPower = 0;
let restPosition = new THREE.Vector3(config.environment.restPosition.x, config.environment.restPosition.y, config.environment.restPosition.z);

// Hand-tracked pivot state (direct displacement — no velocity lag)
let batHandDisplacement = new THREE.Vector3();

/* ================================
   📷 CAMERA TRACKING
================================ */
// Create with the live scene so AvatarRenderer can add 3D nodes to it
const cameraController = new OptionalCameraController(scene);
window.toggleCameraTracking = async () => {
  const btn = document.getElementById('cameraToggleBtn');
  const span = btn.querySelector('span');
  
  if (cameraController && cameraController.isActive()) {
    cameraController.disable();
    btn.classList.remove('active');
    span.innerText = "CAMERA TRACKING: OFF";
  } else {
    span.innerText = "INITIALIZING...";
    await cameraController.enable();
    if (cameraController && cameraController.isActive()) {
      btn.classList.add('active');
      span.innerText = "CAMERA TRACKING: ON";
      
      // Start calibration automatically
      document.getElementById('calibrationOverlay').classList.add('visible');
      const timer = setInterval(() => {
        document.getElementById('calibrationCountdown').innerText = cameraController.calibrationManager.getCountdown();
        if (!cameraController.calibrationManager.isActive()) {
          clearInterval(timer);
          document.getElementById('calibrationOverlay').classList.remove('visible');
        }
      }, 100);
      cameraController.calibrate(restPosition);
    } else {
      span.innerText = "CAMERA FAILED";
      alert("Failed to access camera. Please ensure you are using a secure context (HTTPS or localhost).");
    }
  }
};

/* ================================
   🎮 NAVIGATION & UI HELPERS
================================ */

window.showHome = () => {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
  const cHub = document.getElementById('careerHub');
  if (cHub) cHub.classList.remove('visible');
  
  document.getElementById('teamSelectModal').classList.add('hidden');
  const careerHub = document.getElementById('careerHub');
  if (careerHub) careerHub.classList.remove('visible');
  
  document.getElementById('homeScreen').style.display = 'flex';
  document.getElementById('gameUI').style.display = 'none';
  document.getElementById('matchResultScreen').style.display = 'none';
  isMatchStarted = false;
  isCareerMode = false;
  isTournamentMode = false;
};


function updateSocialFeed() {
  const feed = document.getElementById('career-social-feed');
  if (!feed) return;
  feed.innerHTML = '';

  const posts = [
    { user: 'CricBuzz', text: `Breaking: ${career.data.playerName} is the talk of the domestic circuit!`, time: '2h ago' },
    { user: 'CricketFan99', text: `That last century from ${career.data.playerName.split(' ')[0]} was pure class. 🔥`, time: '4h ago' },
    { user: 'SportsToday', text: `Is ${career.data.playerName} ready for the IPL? Experts weigh in.`, time: '6h ago' }
  ];

  posts.forEach(p => {
    const item = document.createElement('div');
    item.className = 'social-post';
    item.innerHTML = `
      <div class="post-user">@${p.user}</div>
      <div class="post-text">${p.text}</div>
      <div class="post-time">${p.time}</div>
    `;
    feed.appendChild(item);
  });
}

function updateSentiment() {
  const bar = document.getElementById('sentiment-bar');
  const label = document.getElementById('sentiment-label');
  if (!bar || !label) return;

  const rep = career.data.reputation;
  const pct = Math.min(100, (rep / 5000) * 100);
  bar.style.width = `${pct}%`;

  if (pct < 30) label.innerText = "SKEPTICAL";
  else if (pct < 60) label.innerText = "RISING STAR";
  else if (pct < 90) label.innerText = "FAN FAVORITE";
  else label.innerText = "NATIONAL HERO";
}

window.showQuickPlay = () => {
  document.getElementById('homeScreen').style.display = 'none';
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
  document.getElementById('teamSelectModal').classList.remove('hidden');
  isCareerMode = false;
  isTournamentMode = false;
  currentScenario = null;
};

window.startIPLMode = () => {
  document.getElementById('homeScreen').style.display = 'none';
  isCareerMode = false;
  isTournamentMode = true;
  if (!tournament.data) {
    showIPLTeamSelection();
  } else {
    window.showHub();
  }
};

function showIPLTeamSelection() {
  const modal = document.getElementById('iplTeamSelectModal');
  const grid = document.getElementById('iplTeamGrid');
  grid.innerHTML = '';
  modal.classList.add('visible');

  let selectedId = null;
  IPL_ROSTER.teams.forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'opp-btn';
    btn.innerHTML = `<span class="opp-flag">${t.flagEmoji}</span><span>${t.name}</span>`;
    btn.onclick = () => {
      grid.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedId = t.id;
      document.getElementById('confirmIPLTeamBtn').disabled = false;
    };
    grid.appendChild(btn);
  });

  document.getElementById('confirmIPLTeamBtn').onclick = () => {
    tournament.init(selectedId);
    modal.classList.remove('visible');
    window.showHub();
  };
}

window.showHub = () => {
  if (!tournament.data) {
    window.showHome();
    return;
  }
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
  document.getElementById('matchResultScreen').style.display = 'none';

  if (tournament.data.winner) {
    showTournamentOver();
    return;
  }

  const hub = document.getElementById('tournamentHub');
  hub.classList.add('visible');

  const userTeam = getIPLTeam(tournament.data.userTeamId);
  document.getElementById('hubUserTeamName').innerText = userTeam.name.toUpperCase();
  document.getElementById('hubUserTeamLogo').innerText = userTeam.flagEmoji;

  const nextMatch = tournament.getNextMatch();
  if (nextMatch) {
    const t1 = getIPLTeam(nextMatch.team1);
    const t2 = getIPLTeam(nextMatch.team2);
    document.getElementById('nextMatchUserTeam').innerText = t1.shortName;
    document.getElementById('nextMatchOppTeam').innerText = t2.shortName;
    document.getElementById('nextMatchDetails').innerText = `${nextMatch.name || 'Match ' + nextMatch.matchId} · ${nextMatch.date || ''}`;
  } else {
    document.getElementById('nextMatchDetails').innerText = "TOURNAMENT COMPLETE";
  }
};

function showTournamentOver() {
  const screen = document.getElementById('tournamentOverScreen');
  screen.classList.add('visible');
  
  const winner = getIPLTeam(tournament.data.winner);
  document.getElementById('championName').innerText = winner.name.toUpperCase();
  document.getElementById('championSub').innerText = `IPL 2026 CHAMPIONS`;

  const allStats = Object.values(tournament.data.stats);
  const orange = [...allStats].sort((a, b) => b.batting.runs - a.batting.runs)[0];
  const purple = [...allStats].sort((a, b) => b.bowling.wickets - a.bowling.wickets)[0];

  document.getElementById('orangeCapPlayer').innerText = orange.name.toUpperCase();
  document.getElementById('orangeCapRuns').innerText = `${orange.batting.runs} Runs`;
  document.getElementById('purpleCapPlayer').innerText = purple.name.toUpperCase();
  document.getElementById('purpleCapWkts').innerText = `${purple.bowling.wickets} Wickets`;
}

window.resetTournamentAndHome = () => {
  tournament.reset();
  showHome();
};

window.showFixtures = () => {
  document.getElementById('fixturesScreen').classList.add('visible');
  const list = document.getElementById('fixturesList');
  list.innerHTML = '';

  const allFixtures = [...tournament.data.fixtures, ...tournament.data.knockoutFixtures];
  allFixtures.forEach(f => {
    const row = document.createElement('div');
    row.className = 'fixture-row';
    if (f.team1 === tournament.data.userTeamId || f.team2 === tournament.data.userTeamId) row.classList.add('row-user');
    
    const t1 = getIPLTeam(f.team1);
    const t2 = getIPLTeam(f.team2);
    
    let resultText = "Upcoming";
    if (f.result) {
      const winner = getIPLTeam(f.result.winner);
      resultText = `${winner.shortName} won`;
    }

    row.innerHTML = `
      <div class="fixture-date">${f.date || ''}</div>
      <div class="fixture-teams">
        <span>${t1.shortName}</span> <span style="color:rgba(255,255,255,0.2)">vs</span> <span>${t2.shortName}</span>
      </div>
      <div class="fixture-result">${resultText}</div>
    `;
    list.appendChild(row);
  });
};

window.showPointsTable = () => {
  document.getElementById('pointsTableScreen').classList.add('visible');
  const body = document.getElementById('pointsTableBody');
  body.innerHTML = '';

  const table = tournament.getPointsTable();
  table.forEach(t => {
    const row = document.createElement('tr');
    if (t.id === tournament.data.userTeamId) row.className = 'row-user';
    row.innerHTML = `
      <td>${t.name}</td><td>${t.played}</td><td>${t.won}</td><td>${t.lost}</td><td>${t.nr}</td><td>${t.points}</td><td>${t.nrr}</td>
    `;
    body.appendChild(row);
  });
};

window.showStats = () => {
  if (!tournament.data) return;
  document.getElementById('statsScreen').classList.add('visible');
  const topBat = document.getElementById('topBatsmenBody');
  const topRecords = document.getElementById('topRecordsBody');
  topBat.innerHTML = '';
  topRecords.innerHTML = '';

  const allStats = Object.values(tournament.data.stats);
  
  // 1. Orange Cap / Most Runs
  const sortedByRuns = [...allStats].sort((a, b) => b.batting.runs - a.batting.runs);
  const top10Runs = sortedByRuns.slice(0, 10);
  const leaderRuns = sortedByRuns[0]?.batting.runs || 0;

  top10Runs.forEach(s => {
    const avg = s.batting.innings > 0 ? (s.batting.runs / s.batting.innings).toFixed(1) : "0.0";
    const sr = s.batting.ballsFaced > 0 ? ((s.batting.runs / s.batting.ballsFaced) * 100).toFixed(1) : "0.0";
    topBat.innerHTML += `<tr><td>${s.name}</td><td>${s.batting.runs}</td><td>${avg}</td><td>${sr}</td></tr>`;
  });

  // 2. Specialized Records
  // - Highest Score
  const bestHS = [...allStats].sort((a, b) => b.batting.highScore - a.batting.highScore)[0];
  // - Best Average (minimum 5 innings played to avoid outliers)
  const bestAvg = [...allStats].filter(s => s.batting.innings >= 5).sort((a, b) => (b.batting.runs / b.batting.innings) - (a.batting.runs / a.batting.innings))[0];
  // - Best Strike Rate (minimum 10% of top run-scorer's runs to ensure significance)
  const bestSR = [...allStats].filter(s => s.batting.runs >= leaderRuns * 0.1).sort((a, b) => (b.batting.runs / b.batting.ballsFaced) - (a.batting.runs / a.batting.ballsFaced))[0];
  // - Most Fifties
  const most50s = [...allStats].sort((a, b) => b.batting.fifties - a.batting.fifties)[0];
  // - Most Hundreds
  const most100s = [...allStats].sort((a, b) => b.batting.hundreds - a.batting.hundreds)[0];

  const records = [
    { label: "HIGHEST SCORE", p: bestHS, val: bestHS?.batting.highScore },
    { label: "BEST AVERAGE", p: bestAvg, val: bestAvg ? (bestAvg.batting.runs / bestAvg.batting.innings).toFixed(1) : "0.0" },
    { label: "BEST STRIKE RATE", p: bestSR, val: bestSR ? ((bestSR.batting.runs / bestSR.batting.ballsFaced) * 100).toFixed(1) : "0.0" },
    { label: "MOST FIFTIES", p: most50s, val: most50s?.batting.fifties },
    { label: "MOST HUNDREDS", p: most100s, val: most100s?.batting.hundreds },
  ];

  records.forEach(r => {
    if (r.p) {
      topRecords.innerHTML += `<tr><td>${r.label}</td><td>${r.p.name}</td><td>${r.val}</td></tr>`;
    }
  });
};

window.resetTournament = () => {
  if (confirm("Are you sure you want to reset the tournament? All progress will be lost.")) {
    tournament.reset();
    window.startIPLMode();
  }
};

/* ================================
   🏆 CAREER MODE LOGIC
================================ */

window.startCareerMode = () => {
  console.log("startCareerMode clicked");
  if (!career.data) {
    console.log("No career data, prompting for name...");
    const name = prompt("Enter your Player Name:", "C. Player");
    if (!name) return;
    career.init(name);
  }
  window.showCareerHub();
};

window.showCareerHub = () => {
  console.log("showCareerHub called", career.data);
  if (!career.data) return;
  
  // Suppress all other UI
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('gameUI').style.display = 'none';
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
  
  const hub = document.getElementById('careerHub');
  if (hub) {
    hub.classList.add('visible');
    hub.style.display = 'flex'; // Force display
    console.log("careerHub visibility forced");
  } else {
    console.error("careerHub element NOT FOUND");
  }
  
  document.getElementById('career-player-name').innerText = career.data.playerName.toUpperCase();
  
  // Update Reputation
  const rep = career.data.reputation;
  const maxRep = 1000;
  const repPercent = Math.min(100, (rep / maxRep) * 100);
  document.getElementById('reputation-fill').style.width = `${repPercent}%`;
  document.getElementById('reputation-value').innerText = `${rep} / ${maxRep}`;
  
  // Update Stage UI
  const formatLabel = document.getElementById('current-format-label');
  const banner = document.getElementById('career-format-banner');
  banner.className = 'format-banner ' + (career.data.currentStage === 'domestic' ? 'test' : career.data.currentStage);
  
  if (career.data.currentStage === 'domestic') {
    formatLabel.innerText = "DOMESTIC QUALIFIERS (STAGE 1)";
    document.getElementById('career-ipl-milestone').style.display = 'none';
  } else {
    formatLabel.innerText = career.data.currentStage.toUpperCase() + " SEASON";
    document.getElementById('career-ipl-milestone').style.display = 'block';
    
    // Update IPL Milestone
    const runs = career.data.iplTotalRuns;
    const runPercent = Math.min(100, (runs / 1200) * 100);
    document.getElementById('ipl-run-fill').style.width = `${runPercent}%`;
    document.getElementById('ipl-run-text').innerText = `${runs} / 1200 RUNS`;
  }

  window.updateCareerStatsView('all');
  window.renderScenarioGrid();
  updateSocialFeed();
  updateSentiment();
};

window.updateCareerStatsView = (format) => {
  if (!career.data) return;
  
  // Toggle active tab
  const tabs = document.querySelectorAll('.stats-tabs button');
  tabs.forEach(t => t.classList.remove('active'));
  const activeTab = Array.from(tabs).find(t => t.innerText.toLowerCase() === format);
  if (activeTab) activeTab.classList.add('active');

  const stats = format === 'all' 
    ? career.data.stats.test // Default to all? No, let's sum them if 'all'
    : career.data.stats[format];
    
  let displayStats = stats;
  if (format === 'all') {
    displayStats = career.getInitialStats();
    ['test', 'odi', 't20', 'ipl'].forEach(f => {
      const fs = career.data.stats[f];
      displayStats.matches += fs.matches;
      displayStats.innings += fs.innings;
      displayStats.runs += fs.runs;
      displayStats.balls += fs.balls;
      displayStats.fours += fs.fours;
      displayStats.sixes += fs.sixes;
      displayStats.highScore = Math.max(displayStats.highScore, fs.highScore);
    });
    displayStats.average = displayStats.innings > 0 ? (displayStats.runs / displayStats.innings).toFixed(2) : 0;
    displayStats.strikeRate = displayStats.balls > 0 ? ((displayStats.runs / displayStats.balls) * 100).toFixed(2) : 0;
  }

  document.getElementById('stat-matches').innerText = displayStats.matches;
  document.getElementById('stat-runs').innerText = displayStats.runs;
  document.getElementById('stat-avg').innerText = displayStats.average;
  document.getElementById('stat-sr').innerText = displayStats.strikeRate;
  document.getElementById('stat-fours').innerText = displayStats.fours;
  document.getElementById('stat-sixes').innerText = displayStats.sixes;
  document.getElementById('stat-hs').innerText = displayStats.highScore;
};

window.renderScenarioGrid = () => {
  const grid = document.getElementById('career-scenario-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  SCENARIOS.forEach(s => {
    const isCompleted = career.data.completedScenarios.includes(s.id);
    const card = document.createElement('div');
    card.className = `scenario-card ${isCompleted ? 'mastered' : ''}`;
    card.innerHTML = `
      <div class="sc-format" style="color: ${s.format === 'test' ? '#FF5252' : s.format === 'odi' ? '#4FC3F7' : '#AA3BFF'}">${s.format.toUpperCase()}</div>
      <div class="sc-name">${s.name}</div>
      <div class="sc-difficulty">${s.difficulty}</div>
      <div class="sc-desc">${s.desc}</div>
      <div class="sc-status">${isCompleted ? '✅ COMPLETED' : '▶ PLAY'}</div>
    `;
    if (!isCompleted) {
      card.onclick = () => window.loadScenario(s.id);
    }
    grid.appendChild(card);
  });
};

window.loadScenario = (id) => {
  console.log("loadScenario called", id);
  console.trace();
  const scenario = SCENARIOS.find(s => s.id === id);
  if (!scenario) return;

  currentScenario = scenario;
  isCareerMode = true;
  isTournamentMode = false;

  // Setup Teams based on Roster Type
  const uTeamId = scenario.rosterType === 'domestic' ? 'mumbai' : 'india';
  const oTeamId = scenario.rosterType === 'domestic' ? 'delhi' : 'australia';

  // Start Match first to setup scene and objects
  initMatch(uTeamId, oTeamId, false, scenario.rosterType, true, scenario.format);

  // Overwrite Match State from Scenario
  matchState.target = scenario.startScore + 50; 
  matchState.totalRuns = scenario.startScore;
  matchState.wickets = scenario.startWickets;
  matchState.inningsBalls = scenario.startInningsBalls;
  matchState.strikerIndex = scenario.startWickets;
  matchState.nonStrikerIndex = (scenario.startWickets + 1) % 11;
  userBattingIndex = scenario.startWickets; // User walks in at this wicket
  
  // Distribute start score among dismissed players in scorecard
  if (scenario.startWickets > 0) {
    const avgScore = Math.floor(scenario.startScore / scenario.startWickets);
    for (let i = 0; i < scenario.startWickets; i++) {
      if (batsmenStats[i]) {
        batsmenStats[i].runs = avgScore;
        batsmenStats[i].balls = Math.floor(avgScore * 0.9) + 2;
        batsmenStats[i].status = 'out';
      }
    }
  }
  // Ensure User Name is set at the walk-in index
  if (career.data && batsmenStats[userBattingIndex]) {
    batsmenStats[userBattingIndex].name = career.data.playerName;
  }

  // Format and atmosphere now handled inside initMatch

  // Hide Hub and show game UI
  const cHub = document.getElementById('careerHub');
  if (cHub) {
    cHub.classList.remove('visible');
    cHub.style.display = 'none';
  }
  document.getElementById('gameUI').style.display = 'block';
  
  isMatchStarted = true;
  isBallActive = false;
  resetBall(ballObject);
  // matchState.totalRuns is user runs. We need to track the absolute score too.
  matchState.absRunsAtStart = scenario.startScore;
  matchState.absWicketsAtStart = scenario.startWickets;
  matchState.absBallsAtStart = scenario.startInningsBalls;

  showBriefMessage("SCENARIO: " + scenario.name.toUpperCase(), "#FFD54F");
};

window.showTeams = () => {
  document.getElementById('teamsScreen').classList.add('visible');
  const grid = document.getElementById('teamsFranchiseGrid');
  grid.innerHTML = '';

  IPL_ROSTER.teams.forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'opp-btn';
    btn.innerHTML = `<span class="opp-flag">${t.flagEmoji}</span><span>${t.shortName}</span>`;
    btn.onclick = () => window.showTeamStats(t.id);
    grid.appendChild(btn);
  });
  
  // Show first team by default if not already showing something
  if (document.getElementById('teamDetailsCard').style.display === 'none') {
    window.showTeamStats(IPL_ROSTER.teams[0].id);
  }
};

window.showTeamStats = (teamId) => {
  const team = getIPLTeam(teamId);
  const card = document.getElementById('teamDetailsCard');
  card.style.display = 'block';
  card.style.borderColor = team.color;
  
  document.getElementById('detailTeamName').innerText = team.name.toUpperCase();
  document.getElementById('detailTeamName').style.color = team.color;
  
  // Highlight selected team in grid
  document.querySelectorAll('#teamsFranchiseGrid .opp-btn').forEach(btn => {
    if (btn.innerText.includes(team.shortName)) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });

  const body = document.getElementById('teamPlayersBody');
  body.innerHTML = '';

  team.players.forEach(p => {
    const s = tournament.data.stats[p.name] || { batting: { matches: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, lastFive: [] } };
    const b = s.batting;
    const avg = b.innings > 0 ? (b.runs / b.innings).toFixed(1) : (b.matches > 0 ? (b.runs / b.matches).toFixed(1) : "0.0");
    const sr = b.ballsFaced > 0 ? ((b.runs / b.ballsFaced) * 100).toFixed(1) : "0.0";
    
    const last5 = b.lastFive || [];
    const last5Str = last5.length > 0 ? last5.join(', ') : '-';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.name}</td>
      <td>${b.matches}</td>
      <td>${b.runs}</td>
      <td>${b.ballsFaced}</td>
      <td>${b.fours || 0}</td>
      <td>${b.sixes || 0}</td>
      <td>${avg}</td>
      <td>${sr}</td>
      <td style="font-size: 12px; color: rgba(255,255,255,0.4)">${last5Str}</td>
    `;
    body.appendChild(row);
  });
};

window.playNextTournamentMatch = () => {
  const match = tournament.getNextMatch();
  if (!match) return;

  const userTeamId = tournament.data.userTeamId;
  const oppId = match.team1 === userTeamId ? match.team2 : match.team1;
  
  // Coin Toss
  alert(`Match ${match.matchId}: ${getIPLTeam(userTeamId).name} vs ${getIPLTeam(oppId).name}\n\nToss: ${getIPLTeam(userTeamId).name} won the toss and elected to BAT first.`);
  
  initMatch(userTeamId, oppId, true);
};

function initMatch(userTeamId, oppId, isTournament = false, rosterType = 'international', isCareer = false, format = 't20') {
  console.log("initMatch called", { userTeamId, oppId, isTournament, rosterType, isCareer, format });
  console.trace();

  if (rosterType === 'domestic') {
    userTeam = getDomesticTeam(userTeamId);
    opponentTeam = getDomesticTeam(oppId);
  } else if (rosterType === 'ipl' || isTournament) {
    userTeam = getIPLTeam(userTeamId);
    opponentTeam = getIPLTeam(oppId);
  } else {
    userTeam = getTeam(userTeamId);
    opponentTeam = getTeam(oppId);
  }

  isTournamentMode = isTournament;
  isCareerMode = isCareer;

  // 1. Determine and Set Format Early (Critical for FielderSystem)
  const matchFormat = isCareer ? format : (isTournament ? 'ipl' : 't20');
  setFormat(matchFormat);
  document.body.className = matchFormat;

  if (sceneUtils) {
    sceneUtils.setMatchAtmosphere(matchFormat);
    if (isCareer) sceneUtils.updatePlayerKits(matchFormat);
  }
  
  // Setup specialists based on roster type
  let specialists;
  if (rosterType === 'domestic') {
    specialists = getDomesticBowlers(opponentTeam.id);
  } else if (rosterType === 'ipl' || isTournament) {
    specialists = opponentTeam.players.slice(-5);
  } else {
    specialists = getBowlers(opponentTeam.id);
  }
  bowlerStats = specialists.map(p => ({ name: p.name, overs: 0, runs: 0, wickets: 0, balls: 0 }));
  
  if (!isTournament) {
    // Quick Play target
    matchState.target = Math.floor((config.tournamentSettings.minTargetRPO + Math.random() * (config.tournamentSettings.maxTargetRPO - config.tournamentSettings.minTargetRPO)) * 20); 
  } else {
    // Tournament target
    const avgRate = config.tournamentSettings.minTargetRPO + Math.random() * (config.tournamentSettings.maxTargetRPO - config.tournamentSettings.minTargetRPO);
    matchState.target = Math.floor(avgRate * config.tournamentSettings.oversPerMatch);
  }

  matchState.totalRuns = 0;
  matchState.wickets = 0;
  matchState.inningsBalls = 0;
  matchState.overRunsStart = 0;
  matchState.overHistory = [];
  matchState.strikerIndex = 0;
  matchState.nonStrikerIndex = 1;

  document.getElementById('sb-target-score').innerText = matchState.target;
  
  // Setup batsmen
  matchState.battingOrder = userTeam.players.map(p => p.name);
  batsmenStats = userTeam.players.map(p => ({ name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, status: 'not out' }));
  
  if (isCareerMode && career.data) {
    // Replace the name at the walk-in index (usually 0, but will be set by scenario)
    const pIdx = userBattingIndex || 0;
    if (batsmenStats[pIdx]) {
      batsmenStats[pIdx].name = career.data.playerName;
    }
  }
  
  // Update UI Initial
  document.getElementById('sb-bat-flag').innerText = userTeam.flagEmoji || '🏏';
  document.getElementById('sb-bat-short').innerText = userTeam.shortName;
  document.getElementById('sb-bat-team-name').innerText = userTeam.name.toUpperCase();
  document.getElementById('sb-bowl-team-name').innerText = opponentTeam.shortName.toUpperCase();
  
  updateUIScorebar();
  
  initFielders(fielders, bowlerModel, wkModel);
  isMatchStarted = true;
  document.getElementById('teamSelectModal').classList.add('hidden');
  document.getElementById('tournamentHub').classList.remove('visible');
  document.getElementById('gameUI').style.display = 'block';
  
  // Set team colors for all fielders, bowler and keeper
  const oppColor = new THREE.Color(opponentTeam.color);
  if (bowlerModel) bowlerModel.children[0].material.color.copy(oppColor);
  if (wkModel) wkModel.children[0].material.color.copy(oppColor);
  fielders.forEach(f => {
    if (f.children[0]) f.children[0].material.color.copy(oppColor);
  });

  // Atmosphere and Format handled at start of initMatch

  if (isCareerMode && !currentScenario) {
    simulateWalkIn(document.body.className); 
  }
}

function simulateWalkIn(format) {
  const isTest = format === 'test';
  const maxWickets = isTest ? 7 : 5;
  const wickets = Math.floor(Math.random() * maxWickets);
  const runsPerWicket = isTest ? 40 : 30;
  const runs = wickets * runsPerWicket + Math.floor(Math.random() * 50);
  const ballsPerWicket = isTest ? 60 : 30;
  const balls = wickets * ballsPerWicket + Math.floor(Math.random() * 20);

  matchState.totalRuns = runs;
  matchState.wickets = wickets;
  matchState.inningsBalls = balls;
  matchState.strikerIndex = wickets;
  matchState.nonStrikerIndex = wickets + 1;
  userBattingIndex = wickets;
  
  // Target for chase if needed
  matchState.target = runs + 100; // Simplified target

  updateUIScorebar();
  showBriefMessage(`WALKING IN AT ${runs}/${wickets}`, "#4FC3F7");
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
  const totalInningsBalls = (isTournamentMode ? config.tournamentSettings.oversPerMatch : 20) * 6; 
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
  
  // Dynamic scaling for long text
  if (text.length > 20) {
    overlay.style.fontSize = "40px";
    overlay.style.letterSpacing = "4px";
  } else {
    overlay.style.fontSize = "80px";
    overlay.style.letterSpacing = "2px";
  }
  
  overlay.style.opacity = "1";
  overlay.style.transform = "translate(-50%, -50%) scale(1)";
  
  // Update Live Feed with more variety
  const feed = document.getElementById('match-feed');
  if (feed) {
    const entry = document.createElement('div');
    entry.className = 'feed-entry';
    const time = Math.floor(matchState.inningsBalls / 6) + "." + (matchState.inningsBalls % 6);
    const comments = [
      "What a delivery!", "Shot of the day!", "Crowd is going wild!", 
      "Pressure building up...", "Clinical performance.", "That's high into the air!",
      "Beautiful timing.", "Absolute cracker of a ball!"
    ];
    const randComm = comments[Math.floor(Math.random() * comments.length)];
    entry.innerHTML = `<span class="feed-time">${time}</span> <span class="feed-msg">${text} - ${randComm}</span>`;
    feed.prepend(entry);
    if (feed.children.length > 10) feed.lastChild.remove();
  }

  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.style.transform = "translate(-50%, -50%) scale(0.8)";
  }, 1500); 
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

function updateMatchState(runsScored, isWicket = false, isExtraBall = false) {
  if (!isExtraBall) matchState.inningsBalls++;
  const activeStrikerIndex = matchState.strikerIndex; // CAPTURE NOW
  const striker = batsmenStats[activeStrikerIndex];
  const bowler = bowlerStats[currentBowlerIndex];
  
  striker.balls++;
  bowler.balls++;
  
  let dismissedIndex = -1;
  if (isWicket) {
    currentCameraMode = CAMERA_MODES.BATSMAN;
    cameraTargetPos.set(config.cameraSettings.batsmanCamPos.x, config.cameraSettings.batsmanCamPos.y, config.cameraSettings.batsmanCamPos.z);
    camera.position.copy(cameraTargetPos); 
    cameraLookAtTarget.set(config.cameraSettings.batsmanLookAt.x, config.cameraSettings.batsmanLookAt.y, config.cameraSettings.batsmanLookAt.z);
    camera.lookAt(cameraLookAtTarget);
    matchState.wickets++;
    bowler.wickets++;
    striker.status = 'caught';
    dismissedIndex = activeStrikerIndex;
    
    matchState.strikerIndex = Math.max(matchState.strikerIndex, matchState.nonStrikerIndex) + 1;
    if (matchState.strikerIndex >= 11) matchState.strikerIndex = 10; 

    // Career Mode: User got out
    if (isCareerMode && dismissedIndex === userBattingIndex) {
      if (currentScenario.goalType === 'personal') {
        // Personal goal failed or finished
        isMatchStarted = false;
        setTimeout(() => showMatchResult('loss'), 1500);
      } else {
        // Team goal: Simulate rest of innings instantly
        const totalInningsBalls = (document.body.className === 'test' ? 540 : (document.body.className === 'odi' ? 300 : 120));
        const ballsLeft = Math.max(0, totalInningsBalls - matchState.inningsBalls);
        let simRuns = 0;
        for (let i = 0; i < ballsLeft; i++) {
          const r = Math.random();
          if (r < 0.05) break; // Wickets fall
          if (r < 0.5) simRuns += 0;
          else if (r < 0.8) simRuns += 1;
          else if (r < 0.9) simRuns += 2;
          else if (r < 0.97) simRuns += 4;
          else simRuns += 6;
        }
        matchState.totalRuns += simRuns;
        matchState.inningsBalls += ballsLeft;
        
        // Show result after a short delay with a "Next" button feel
        alert(`You got out! \n\nTeam finished the innings.\nFinal Score: ${matchState.totalRuns}/${matchState.wickets}\n\nClick OK to see results.`);
        isMatchStarted = false;
        showMatchResult(matchState.totalRuns >= matchState.target ? 'win' : 'loss');
      }
      return; // Stop further processing
    }

    const outEl = document.getElementById('outScreen');
    document.getElementById('out-name').innerText = striker.name;
    document.getElementById('out-runs').innerText = striker.runs;
    document.getElementById('out-balls').innerText = striker.balls;
    document.getElementById('out-fours').innerText = striker.fours;
    document.getElementById('out-sixes').innerText = striker.sixes;
    document.getElementById('out-sr').innerText = striker.balls > 0 ? ((striker.runs / striker.balls) * 100).toFixed(1) : "0.0";
    
    outEl.classList.add('visible');
    setTimeout(() => outEl.classList.remove('visible'), 2000); 
  } else {
    matchState.totalRuns += runsScored;
    striker.runs += runsScored;
    bowler.runs += runsScored;
    if (runsScored === 4) { striker.fours++; showBriefMessage("FOUR!", "#4CAF50"); }
    else if (runsScored === 6) { striker.sixes++; showBriefMessage("SIX!", "#4CAF50"); }
    else if (runsScored > 0) showBriefMessage(`${runsScored} RUNS`, "#FFF");
    else showBriefMessage("DOT BALL", "#90A4AE");
  }

  // Immediate win check for Career Mode
  if (isCareerMode && currentScenario && isMatchStarted) {
    const tRuns = matchState.totalRuns - matchState.absRunsAtStart;
    const uRuns = batsmenStats[userBattingIndex] ? batsmenStats[userBattingIndex].runs : 0;
    const wkts = matchState.wickets - matchState.absWicketsAtStart;
    const balls = matchState.inningsBalls - matchState.absBallsAtStart;
    
    if (currentScenario.condition(tRuns, uRuns, wkts, balls)) {
      isMatchStarted = false;
      setTimeout(() => showMatchResult('win'), 1000);
      return;
    }
  }
  
  // ── Wagon Wheel: record landing position ──
  const landing = firstBouncePos || { x: ballObject.position.x, z: ballObject.position.z };
  wagonWheelData.push({ 
    x: landing.x, 
    z: landing.z, 
    runs: runsScored, 
    isAerial: !ballHasBouncedAfterHit,
    batterIndex: activeStrikerIndex 
  });

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
    // ── End of Over Screen ──
    const overNum = matchState.inningsBalls / 6;
    const overRuns = matchState.totalRuns - matchState.overRunsStart;
    matchState.overRunsStart = matchState.totalRuns;
    const lastBowler = bowlerStats[currentBowlerIndex];
    const striker = batsmenStats[matchState.strikerIndex];
    const nstriker = batsmenStats[matchState.nonStrikerIndex];
    const runsNeeded = Math.max(0, matchState.target - matchState.totalRuns);
    const totalInningsBalls = (isTournamentMode ? config.tournamentSettings.oversPerMatch : 20) * 6;
    const ballsLeft = Math.max(0, totalInningsBalls - matchState.inningsBalls);
    document.getElementById('oe-over-number').innerText = `OVER ${overNum}`;
    document.getElementById('oe-bowler').innerText = lastBowler.name;
    document.getElementById('oe-over-runs').innerText = `${overRuns} RUNS`;
    document.getElementById('oe-striker').innerText = `${striker.name} ${striker.runs}*(${striker.balls})`;
    document.getElementById('oe-nstriker').innerText = `${nstriker.name} ${nstriker.runs}(${nstriker.balls})`;
    document.getElementById('oe-need').innerText = `${runsNeeded} RUNS`;
    document.getElementById('oe-balls-left').innerText = `${ballsLeft} BALLS`;
    const oeEl = document.getElementById('overEndScreen');
    oeEl.classList.add('visible');
    setTimeout(() => oeEl.classList.remove('visible'), 4000); 

    matchState.overHistory = []; // Reset history for new over
    let temp = matchState.strikerIndex;
    matchState.strikerIndex = matchState.nonStrikerIndex;
    matchState.nonStrikerIndex = temp;
    currentBowlerIndex = (currentBowlerIndex + 1) % 5;
    updateFieldersEndOfOver(overNum);
  }
  
  updateUIScorebar();
  
  const lb = document.getElementById('sb-last-ball-badge');
  lb.innerText = isWicket ? 'W' : runsScored;
  lb.style.background = runsScored === 4 || runsScored === 6 ? '#43A047' : (isWicket ? '#D32F2F' : 'rgba(255,255,255,0.1)');

  // Keep contact diagram visible until next ball
  // document.getElementById('contactDiagram').style.display = 'none'; // Removed hiding

  checkMatchEnd();

  // Strike Rotation Logic: ONLY in Career Mode
  if (isCareerMode && isMatchStarted && matchState.strikerIndex !== userBattingIndex) {
    setTimeout(simulateAIStrike, 1200);
  }
}

async function simulateAIStrike() {
  if (!isMatchStarted) return;
  
  const flash = document.getElementById('ai-flash-card');
  const content = document.getElementById('flash-content');
  flash.classList.add('visible');
  content.innerText = "Non-striker taking charge...";

  // Wait a bit before starting
  await new Promise(r => setTimeout(r, 1000));

  while (matchState.strikerIndex !== userBattingIndex && isMatchStarted) {
    const r = Math.random();
    let runs = 0;
    let isWicket = false;

    if (r < 0.05) isWicket = true;
    else if (r < 0.45) runs = 0;
    else if (r < 0.75) runs = 1;
    else if (r < 0.85) runs = 2;
    else if (r < 0.95) runs = 4;
    else runs = 6;

    // Record ball
    matchState.inningsBalls++;
    const striker = batsmenStats[matchState.strikerIndex];
    const bowler = bowlerStats[currentBowlerIndex];
    if (striker) striker.balls++;
    if (bowler) bowler.balls++;

    if (isWicket) {
      matchState.wickets++;
      if (bowler) bowler.wickets++;
      if (striker) striker.status = 'out';
      matchState.strikerIndex = Math.max(matchState.strikerIndex, matchState.nonStrikerIndex) + 1;
      if (matchState.strikerIndex >= 11) matchState.strikerIndex = 10;
      content.innerText = "WICKET FALLS!";
    } else {
      matchState.totalRuns += runs;
      if (striker) striker.runs += runs;
      if (bowler) bowler.runs += runs;
      if (runs === 4 && striker) striker.fours++;
      if (runs === 6 && striker) striker.sixes++;
      content.innerText = runs === 0 ? "DOT BALL" : `${runs} RUNS`;

      // Rotation
      if (runs % 2 !== 0) {
        let temp = matchState.strikerIndex;
        matchState.strikerIndex = matchState.nonStrikerIndex;
        matchState.nonStrikerIndex = temp;
      }
    }

    // Over History
    const ballLabel = isWicket ? 'W' : runs;
    matchState.overHistory.push({ label: ballLabel, runs: runs, isWicket });

    updateUIScorebar();
    
    // Pause for visibility
    await new Promise(r => setTimeout(r, 1000));

    // Over end check
    if (matchState.inningsBalls % 6 === 0) {
      flash.classList.remove('visible');
      // Trigger over end logic without double-counting the ball
      updateMatchState(0, false, true); 
      return;
    }
    
    checkMatchEnd();
    if (!isMatchStarted) break;
  }

  flash.classList.remove('visible');
}

function checkMatchEnd() {
  const runsNeeded = matchState.target - matchState.totalRuns;
  const isTest = document.body.className === 'test';
  let totalInningsBalls = 120; // Default T20
  
  if (isTest) {
    totalInningsBalls = 540; // 90 overs per day approx
  } else if (isTournamentMode) {
    totalInningsBalls = config.tournamentSettings.oversPerMatch * 6;
  } else if (document.body.className === 'odi') {
    totalInningsBalls = 300; // 50 overs
  }

  const ballsLeft = totalInningsBalls - matchState.inningsBalls;
  const isWicketsAllOut = matchState.wickets >= 10;
  
  let endType = null; // 'win', 'loss'
  
  if (runsNeeded <= 0 && !isTest) {
    endType = 'win';
  } else if ((ballsLeft <= 0 || isWicketsAllOut) && !isTest) {
    endType = 'loss';
  } else if (isTest && (isWicketsAllOut || ballsLeft <= 0)) {
    // In Test, if balls run out or all out, it's a draw or loss depending on context
    // For Career, we check scenario condition in showMatchResult
    endType = 'loss'; 
  }

  if (endType) {
    isMatchStarted = false;
    setTimeout(() => showMatchResult(endType), 1500);
  }
}

function showMatchResult(type) {
  document.getElementById('gameUI').style.display = 'none';
  const screen = document.getElementById('matchResultScreen');
  screen.style.display = 'flex';

  const title = document.getElementById('resultTitle');
  const summary = document.getElementById('resultSummary');
  const details = document.getElementById('resultDetails');

  if (type === 'win') {
    title.innerText = "VICTORY!";
    title.className = "result-title victory";
    summary.innerText = `${userTeam.name} won by ${10 - matchState.wickets} wickets`;
  } else {
    title.innerText = "DEFEAT";
    title.className = "result-title defeat";
    const runsShort = matchState.target - matchState.totalRuns;
    summary.innerText = `${userTeam.name} lost by ${runsShort} runs`;
  }

  details.innerHTML = `
    <div style="font-size: 24px; color: var(--primary); margin-bottom: 10px;">
      Final Score: ${matchState.totalRuns}/${matchState.wickets} in ${Math.floor(matchState.inningsBalls / 6)}.${matchState.inningsBalls % 6} overs
    </div>
  `;

  if (isCareerMode && currentScenario) {
    const tRuns = matchState.totalRuns - matchState.absRunsAtStart;
    const uRuns = batsmenStats[userBattingIndex] ? batsmenStats[userBattingIndex].runs : 0;
    const success = currentScenario.condition(tRuns, uRuns, 0, 0); // Simplified check for UI

    details.innerHTML += `
      <div class="scenario-result-box" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-top: 20px; border-left: 4px solid ${success ? '#4CAF50' : '#F44336'}">
        <h3 style="margin: 0 0 10px 0; color: ${success ? '#4CAF50' : '#F44336'}">${success ? 'GOALS ACHIEVED' : 'GOALS FAILED'}</h3>
        <p style="margin: 5px 0"><b>Personal:</b> ${uRuns} Runs (Goal: ${currentScenario.desc.includes('runs') ? 'Met' : 'N/A'})</p>
        <p style="margin: 5px 0"><b>Team:</b> ${tRuns} Runs added during your stay</p>
        <p style="margin: 5px 0; font-size: 14px; opacity: 0.7;">Objective: ${currentScenario.desc}</p>
      </div>
    `;
  }

  if (isTournamentMode) {
    const result = {
      winner: type === 'win' ? userTeam.id : opponentTeam.id,
      team1: { runs: matchState.totalRuns, wickets: matchState.wickets, overs: parseFloat((matchState.inningsBalls / 6).toFixed(1)) },
      team2: { runs: matchState.target - 1, wickets: 5, overs: config.tournamentSettings.oversPerMatch } 
    };
    // Pass actual stats
    tournament.recordUserMatchResult(result, batsmenStats, bowlerStats);
  } else if (isCareerMode && currentScenario) {
    const teamRunsScored = matchState.totalRuns - matchState.absRunsAtStart;
    const userRunsScored = batsmenStats[userBattingIndex] ? batsmenStats[userBattingIndex].runs : 0;
    const wicketsLost = matchState.wickets - matchState.absWicketsAtStart;
    const ballsFaced = matchState.inningsBalls - matchState.absBallsAtStart;
    
    const isSuccess = currentScenario.condition(teamRunsScored, userRunsScored, wicketsLost, ballsFaced);
    if (isSuccess) {
      career.completeScenario(currentScenario.id, currentScenario.repGained);
      career.updateStats(currentScenario.format, {
        runs: userRunsScored,
        balls: batsmenStats[userBattingIndex] ? batsmenStats[userBattingIndex].balls : 0,
        fours: batsmenStats[userBattingIndex] ? batsmenStats[userBattingIndex].fours : 0,
        sixes: batsmenStats[userBattingIndex] ? batsmenStats[userBattingIndex].sixes : 0
      });
      showBriefMessage("SCENARIO COMPLETE! +" + currentScenario.repGained + " REP", "#4CAF50");
    } else {
      showBriefMessage("SCENARIO FAILED", "#F44336");
    }
    
    // Check if all domestic scenarios done
    if (career.data.completedScenarios.length === 12 && career.data.currentStage === 'domestic') {
      career.data.currentStage = 'ipl';
      career.data.milestones.iplCallup = true;
      career.save();
      alert("CONGRATULATIONS! You have been scouted for the IPL!");
    }

    if (currentScenario && currentScenario.id === 'wc_final' && isSuccess) {
      triggerWorldCupCelebration();
    }
  } else if (isCareerMode) {
    // Normal Career Match (IPL or International)
    const runs = batsmenStats[userBattingIndex].runs;
    const balls = batsmenStats[userBattingIndex].balls;
    const fours = batsmenStats[userBattingIndex].fours;
    const sixes = batsmenStats[userBattingIndex].sixes;
    const format = document.body.className;

    career.updateStats(format, { runs, balls, fours, sixes });
    showBriefMessage(`MATCH OVER: ${runs} RUNS`, "#4FC3F7");
    
    if (career.data.milestones.nationalCallup && career.data.currentStage === 'international') {
      alert("NATIONAL CALL-UP! You have been selected for the Indian National Team!");
    }
  }
}

function triggerWorldCupCelebration() {
  const overlay = document.createElement('div');
  overlay.className = 'wc-celebration';
  overlay.innerHTML = `
    <div class="celeb-content">
      <div class="celeb-title">WORLD CHAMPIONS</div>
      <div class="celeb-sub">You have led India to World Cup Glory!</div>
      <div class="celeb-stats">
        <span>RUNS: ${career.data.stats.odi.runs}</span>
        <span>REPUTATION: ${career.data.reputation}</span>
      </div>
      <button onclick="location.reload()" class="action-btn">RETIRE AS A LEGEND</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function launchBall() {
  // Pause button if any summary screen or scorecard is active
  if (document.getElementById('outScreen').classList.contains('visible')) return;
  if (document.getElementById('overEndScreen').classList.contains('visible')) return;
  if (document.getElementById('wagonWheelOverlay').classList.contains('visible')) return;
  if (document.getElementById('scorecardOverlay').classList.contains('visible')) return;
  
  if (isBallActive || runState.isRunning || runState.isThrowing) return;
  
  // Hide impact diagram when new ball starts
  document.getElementById('contactDiagram').style.display = 'none';
  
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
  
  const formatKey = (isCareerMode && currentScenario) ? currentScenario.format : (isTournamentMode ? 'ipl' : 't20');
  const format = config.formatSettings[formatKey];

  // Bowler classification logic
  const specialists = isTournamentMode ? opponentTeam.players.slice(-5) : getBowlers(opponentTeam.id);
  const currentBowler = specialists[currentBowlerIndex];
  const isSpinner = currentBowler.bowlType === 'spin';

  // Spinners have more speed variation
  let speed = config.deliverySettings.baseSpeed + (Math.random() - 0.5) * 2 * config.deliverySettings.speedVariance;
  if (isSpinner) {
    speed = config.deliverySettings.baseSpeed * (0.70 + Math.random() * 0.15);
  }

  // AI Bowling Logic: Channel vs Variation
  let targetX;
  const isVariation = Math.random() < format.aiVariationFreq;
  
  if (!isVariation && formatKey === 'test') {
    // Channel Bowling: Aim for 4th stump (0.3 to 0.7)
    targetX = 0.3 + Math.random() * 0.4;
  } else {
    // Standard random target
    targetX = config.deliverySettings.pitchXMin + Math.random() * (config.deliverySettings.pitchXMax - config.deliverySettings.pitchXMin);
  }
  targetX = Math.max(-1.1, Math.min(1.1, targetX));
  
  const pitchZ = config.deliverySettings.pitchZMin + Math.random() * (config.deliverySettings.pitchZMax - config.deliverySettings.pitchZMin);
  
  const releaseZ = config.bowlerSettings.releaseZ;
  const timeToPitch = (pitchZ - releaseZ) / speed;
  const releaseX = getBowlerReleaseX();
  
  // Calculate swing and spin
  let swingX = (targetX - releaseX) / timeToPitch;
  let spinX = 0;
  
  if (!isSpinner) {
    // Pacers swing *towards* the target but might deviate slightly
    const randomSwing = (Math.random() - 0.5) * 2 * 0.8 * format.swingMult; 
    swingX += randomSwing;
  } else {
    // Normalizing speed to get a factor (lower speed = higher factor)
    const speedFactor = (config.deliverySettings.baseSpeed * 0.75) / speed; 
    const baseTurn = 3.0 + Math.random() * 2.5;
    spinX = (Math.random() > 0.5 ? 1 : -1) * baseTurn * speedFactor * (isVariation ? 1.5 : 1.0);
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
      requestAnimationFrame(() => {
        if (shotMode === 'none') {
          indicator.style.opacity = '0';
          indicator.style.pointerEvents = 'none';
        } else {
          indicator.style.opacity = '1';
          indicator.style.pointerEvents = 'auto';
          label.innerText = shotMode === 'loft' ? 'LOFT' : 'STROKE';
          document.getElementById('modeDot').style.background = shotMode === 'loft' ? '#FF5252' : '#4CAF50';
        }
      });
    }
    return;
  }

  if (data.type !== 'motion') return;
  addMotionData(data.data.acc, data.data.gyro.map(v => Math.abs(v) < config.GYRO_DEADZONE ? 0 : v));
  
  if (!batObject) return;
  const rawAccArr = data.data.acc;
  const rawGyro = data.data.gyro;
  const rawAcc = new THREE.Vector3(...rawAccArr);
  const alpha = 0.98; // Higher alpha = more sensitive to movement, less drift
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

  // --- Hand-Tracked Pivot (direct, no velocity lag) ---
  const bt = config.batTranslation;

  // Directly shift displacement by linear acceleration — immediate response
  batHandDisplacement.addScaledVector(worldAcc, bt.sensitivity);

  // Decay displacement each packet so it returns to rest when hand is still
  batHandDisplacement.multiplyScalar(bt.decayFactor);

  // Clamp to max travel bounds
  const md = bt.maxDisplacement;
  batHandDisplacement.x = Math.max(-md.x, Math.min(md.x, batHandDisplacement.x));
  batHandDisplacement.y = Math.max(-md.y, Math.min(md.y, batHandDisplacement.y));
  batHandDisplacement.z = Math.max(-md.z, Math.min(md.z, batHandDisplacement.z));

  // Apply: rest position + hand displacement
  batObject.position.copy(restPosition).add(batHandDisplacement);
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') launchBall();
  if (e.code === 'KeyS') toggleScorecard();
  if (e.code === 'KeyR') {
    calibrationQuaternion.copy(currentOrientation).invert();
    batHandDisplacement.set(0, 0, 0);
  }
  if (e.code === 'KeyT') {
    if (cameraController.isActive()) {
      document.getElementById('calibrationOverlay').classList.add('visible');
      const timer = setInterval(() => {
        document.getElementById('calibrationCountdown').innerText = cameraController.calibrationManager.getCountdown();
        if (!cameraController.calibrationManager.isActive()) {
          clearInterval(timer);
          document.getElementById('calibrationOverlay').classList.remove('visible');
        }
      }, 100);
      cameraController.calibrate(restPosition);
    }
  }

  if (e.code === 'KeyS') {
    if (cameraController && cameraController.isActive() && batObject) {
      // Set the rest position (the 'X' marker) to where the skeleton currently is
      restPosition.x = batObject.position.x;
      restPosition.z = batObject.position.z;
      
      // Instantly recalibrate so the skeleton doesn't jump due to the restPosition change
      cameraController.instantCalibrate();
      
      // Also update the config so it persists for the session if needed
      config.environment.restPosition.x = restPosition.x;
      config.environment.restPosition.z = restPosition.z;
      
      showBriefMessage("GUARD SET", "#4FC3F7");
    }
  }
  
  // Adjust Batter Guard (Rest Position)
  const step = 0.05;
  if (e.code === 'ArrowUp') restPosition.z -= step;    // Towards Bowler
  if (e.code === 'ArrowDown') restPosition.z += step;  // Towards Stumps
  if (e.code === 'ArrowLeft') restPosition.x -= step;  // Towards Leg-side (for RHB)
  if (e.code === 'ArrowRight') restPosition.x += step; // Towards Off-side (for RHB)

  if (e.code === 'KeyW') {
    wagonWheelVisible = !wagonWheelVisible;
    const overlay = document.getElementById('wagonWheelOverlay');
    if (wagonWheelVisible) {
      overlay.classList.add('visible');
      // Rebuild batter tabs
      const tabs = document.getElementById('wwTabs');
      tabs.innerHTML = `<div class="ww-tab active" data-idx="-1" onclick="switchWagonTab(this,-1)">TEAM</div>`;
      batsmenStats.forEach((b, i) => {
        const t = document.createElement('div');
        t.className = 'ww-tab';
        t.dataset.idx = i;
        t.innerText = b.name.split(' ').pop().toUpperCase(); // Last name only
        t.onclick = () => switchWagonTab(t, i);
        tabs.appendChild(t);
      });
      drawWagonWheel(wagonWheelTab);
    } else {
      overlay.classList.remove('visible');
    }
  }
});

/* ================================
   🎡 WAGON WHEEL
================================ */

window.switchWagonTab = function(el, idx) {
  document.querySelectorAll('.ww-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  wagonWheelTab = idx;
  drawWagonWheel(idx);
};

function drawWagonWheel(filterIdx) {
  const canvas = document.getElementById('wagonWheelCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const boundaryR = W * 0.46;
  const infieldR = W * 0.22; // Reduced infield circle size
  const pitchW = W * 0.04, pitchH = H * 0.2;

  ctx.clearRect(0, 0, W, H);
  
  // Outer circle (Boundary)
  ctx.beginPath(); ctx.arc(cx, cy, boundaryR + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#0a2a0a'; ctx.fill();

  // Outfield
  ctx.beginPath(); ctx.arc(cx, cy, boundaryR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a4a1a'; ctx.fill();

  // Infield circle
  ctx.beginPath(); ctx.arc(cx, cy, infieldR, 0, Math.PI * 2);
  ctx.fillStyle = '#22552a'; ctx.fill();

  // Boundary rope
  ctx.beginPath(); ctx.arc(cx, cy, boundaryR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();

  // Infield ring
  ctx.beginPath(); ctx.arc(cx, cy, infieldR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

  // Pitch
  ctx.fillStyle = '#D2B48C';
  ctx.fillRect(cx - pitchW / 2, cy - pitchH / 2, pitchW, pitchH);

  // Direction labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '11px Rajdhani, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('COVER', cx + boundaryR * 0.65, cy - boundaryR * 0.65);
  ctx.fillText('MID-ON', cx - boundaryR * 0.65, cy - boundaryR * 0.65);
  ctx.fillText('FINE LEG', cx + boundaryR * 0.55, cy + boundaryR * 0.75);
  ctx.fillText('SQUARE', cx - boundaryR * 0.78, cy);

  // Draw shots
  const subset = filterIdx === -1
    ? wagonWheelData
    : wagonWheelData.filter(d => d.batterIndex === filterIdx);

  const mapScale = boundaryR / (config.BOUNDARY_R || 40);

  subset.forEach(shot => {
    const sx_raw = cx + shot.x * mapScale;
    const sz_raw = cy + shot.z * mapScale;
    
    const startX = cx; // Batsman x is always center
    const startZ = cy + (4.5 * mapScale); // Batsman z is at 4.5

    // For boundaries, ensure the line extends to or slightly past the visual boundary
    let sx = sx_raw;
    let sz = sz_raw;
    if (shot.runs >= 4) {
      const vecX = sx_raw - startX;
      const vecZ = sz_raw - startZ;
      const distToLanding = Math.sqrt(vecX**2 + vecZ**2);
      // We want to extend it relative to ground center (cx,cy) for the visual boundary
      const distFromCenter = Math.sqrt((sx_raw - cx)**2 + (sz_raw - cy)**2);
      if (distFromCenter < boundaryR) {
        const factor = (boundaryR + 2) / distFromCenter;
        sx = cx + (sx_raw - cx) * factor;
        sz = cy + (sz_raw - cy) * factor;
      }
    }

    let color;
    if (shot.runs === 6) color = '#FF5252';
    else if (shot.runs === 4) color = '#4CAF50';
    else if (shot.runs > 0) color = '#FFD54F';
    else color = 'rgba(255,255,255,0.3)';

    // Line from striker to landing
    ctx.beginPath();
    ctx.moveTo(startX, startZ);
    
    if (shot.isAerial) {
      // Draw quadratic curve for aerial shots
      const midX = (startX + sx) / 2;
      const midZ = (startZ + sz) / 2;
      // Offset midpoint slightly to the side to show a curve
      const dx = sx - startX;
      const dz = sz - startZ;
      const perpX = -dz * 0.15;
      const perpZ = dx * 0.15;
      ctx.quadraticCurveTo(midX + perpX, midZ + perpZ, sx, sz);
    } else {
      ctx.lineTo(sx, sz);
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = shot.runs >= 4 ? 2 : 1;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Dot at landing
    ctx.beginPath(); ctx.arc(sx, sz, shot.runs >= 4 ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  });

  // Legend
  const legend = [['#FF5252','SIX'], ['#4CAF50','FOUR'], ['#FFD54F','1-3'], ['rgba(255,255,255,0.3)','DOT']];
  let lx = cx - boundaryR + 8, ly = H - 18;
  ctx.font = 'bold 11px Rajdhani, sans-serif'; ctx.textAlign = 'left';
  legend.forEach(([col, lbl]) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx + 5, ly - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(lbl, lx + 13, ly);
    lx += 56;
  });

  // Shot count
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'right';
  ctx.fillText(`${subset.length} SHOT${subset.length !== 1 ? 'S' : ''}`, W - 8, H - 10);
}

/* ================================
   📍 MINIMAP RENDERER
================================ */

let minimapFrameCount = 0;
function drawMinimap() {
  minimapFrameCount++;
  if ((isBallActive || isBallHit) && (minimapFrameCount % 4 !== 0)) {
    return;
  }
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

  // Ball trail
  if ((isBallActive || isBallHit) && ballTrail.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,100,0.6)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(cx + ballTrail[0].x * scale, cy + ballTrail[0].z * scale);
    for (let i = 1; i < ballTrail.length; i++) {
      ctx.lineTo(cx + ballTrail[i].x * scale, cy + ballTrail[i].z * scale);
    }
    ctx.stroke();
  }

  if (isBallActive || isBallHit) {
    // Push current position to trail (cap at 30 points)
    ballTrail.push({ x: ballObject.position.x, z: ballObject.position.z });
    if (ballTrail.length > 30) ballTrail.shift();
    drawDot(ballObject.position, '#FFFF00', 3.5);
  }
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
  
  if (guardMarkerObject) {
    guardMarkerObject.position.set(restPosition.x, 0, restPosition.z);
  }

  // --- Camera Pose Update ---
  const isOverlayVisible = 
    document.getElementById('outScreen').classList.contains('visible') ||
    document.getElementById('overEndScreen').classList.contains('visible') ||
    document.getElementById('scorecardOverlay').classList.contains('visible') ||
    document.getElementById('wagonWheelOverlay').classList.contains('visible');

  if (cameraController && cameraController.isActive() && !isOverlayVisible) {
    const trackingData = cameraController.update(currentOrientation, restPosition);
    if (trackingData && trackingData.fusedTransform) {
      batObject.position.copy(trackingData.fusedTransform.position);
      batObject.quaternion.copy(calibrationQuaternion).multiply(trackingData.fusedTransform.quaternion);
    }
  }

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
          
          let weightTransfer = 0.0;
          if (cameraController && cameraController.isActive()) {
            const metrics = cameraController.stanceAnalyzer.getMetrics();
            if (metrics) {
              weightTransfer = metrics.weightTransfer || 0.0;
            }
          }
          
          const incomingVel = new THREE.Vector3(d.swingX, 0, d.speed);
          const shot = computeShotFromContact(contact, batObject, incomingVel, currentWorldAngularVelocity, currentSwingPower, weightTransfer);
          
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
       // Use the imported onBallLanded from FielderSystem
       if (typeof onBallLanded === 'function') {
         onBallLanded(ballObject.position, Math.floor(matchState.inningsBalls / 6));
       }
    }
    
    const dist = Math.sqrt(ballObject.position.x**2 + ballObject.position.z**2);
    if (dist >= config.BOUNDARY_R - 0.5) {
       let runs = ballHasBouncedAfterHit ? 4 : 6;
       isBallHit = false; runState.isRunning = false; runState.isThrowing = false;
       document.getElementById('pipMinimap').style.display = 'none';
       currentCameraMode = CAMERA_MODES.BATSMAN; // Return camera to batting view
       updateMatchState(runs);
    } else {
       const fieldRes = updateFielderChasing(dt, ballObject, ballVelocity, isAirborne);
       if (fieldRes.isGathering) ballVelocity.set(0, 0, 0);
       if (fieldRes.fielded) {
          if (fieldRes.caught) {
             isBallHit = false; runState.isRunning = false;
             currentCameraMode = CAMERA_MODES.BATSMAN; // Return camera to batting view
             showBriefMessage("OUT! CAUGHT", "#FF5252");
             updateMatchState(0, true);
             document.getElementById('pipMinimap').style.display = 'none';
          } else if (!runState.isThrowing) {
             isBallHit = false; runState.isThrowing = true; runState.isRunning = false;
             
             // Runners run to the closest end
             if (runState.runnerProgress > 0.7) {
                // More than 70%, complete this run
                runState.targetRuns = runState.runsAttempted + 1;
                runState.targetProgress = 1.0;
             } else {
                // Less than 70%, run back
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
        currentCameraMode = CAMERA_MODES.BATSMAN; // Return camera to batting view
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

function setupMainMenu() {
  const careerBtn = document.querySelector('.home-btn:nth-child(1)');
  const iplBtn = document.querySelector('.home-btn:nth-child(2)');
  const quickBtn = document.querySelector('.home-btn:nth-child(3)');

  if (careerBtn) careerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Career Mode clicked via listener");
    window.startCareerMode();
  });
  
  if (iplBtn) iplBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("IPL Mode clicked via listener");
    window.startIPLMode();
  });
  
  if (quickBtn) quickBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Quick Play clicked via listener");
    window.showQuickPlay();
  });
}

setupTeamSelect();
setupMainMenu();
requestAnimationFrame(animate);
