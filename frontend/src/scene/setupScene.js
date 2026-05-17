import * as THREE from 'three';
import { config } from '../config.js';

export function setupScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 512;   // was 1024 — halves shadow GPU cost
  sunLight.shadow.mapSize.height = 512;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 250;
  sunLight.shadow.camera.left = -35;
  sunLight.shadow.camera.right = 35;
  sunLight.shadow.camera.top = 35;
  sunLight.shadow.camera.bottom = -35;
  scene.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x1B5E20, 0.6);
  scene.add(hemiLight);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const lights = { sunLight, hemiLight, ambientLight, floodlights: [] };

  function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = config.colors.grassColor;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = config.colors.grassMowColor;
    ctx.lineWidth = 40;
    for (let r = 20; r < 512; r += 80) {
      ctx.beginPath(); ctx.arc(256, 256, r, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 15000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    return texture;
  }

  function createPitchTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = config.colors.pitchColor;
    ctx.fillRect(0, 0, 256, 512);
    const grad = ctx.createRadialGradient(128, 450, 20, 128, 450, 100);
    grad.addColorStop(0, '#A08060');
    grad.addColorStop(1, 'rgba(210, 180, 140, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 50, 256, 412);
    ctx.strokeStyle = config.colors.pitchMarkingColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(20, 50); ctx.lineTo(236, 50);
    ctx.moveTo(20, 462); ctx.lineTo(236, 462);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 80); ctx.lineTo(256, 80);
    ctx.moveTo(0, 432); ctx.lineTo(256, 432);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, 0); ctx.lineTo(50, 80);
    ctx.moveTo(206, 0); ctx.lineTo(206, 80);
    ctx.moveTo(50, 432); ctx.lineTo(50, 512);
    ctx.moveTo(206, 432); ctx.lineTo(206, 512);
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
  }

  const grassTexture = createGrassTexture();
  const pitchTexture = createPitchTexture();

  const planeGeometry = new THREE.PlaneGeometry(600, 600);
  const planeMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1.0, metalness: 0.0 });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  const boundaryGeo = new THREE.TorusGeometry(config.BOUNDARY_R, 0.4, 12, 128);
  const boundaryMat = new THREE.MeshStandardMaterial({ color: config.colors.boundaryColor });
  const boundary = new THREE.Mesh(boundaryGeo, boundaryMat);
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.y = 0.4;
  scene.add(boundary);

  const innerCircleGeo = new THREE.RingGeometry(config.INFIELD_R - 0.4, config.INFIELD_R + 0.4, 64);
  const innerCircleMat = new THREE.MeshBasicMaterial({ color: config.colors.boundaryColor, side: THREE.DoubleSide, opacity: 0.5, transparent: true });
  const innerCircle = new THREE.Mesh(innerCircleGeo, innerCircleMat);
  innerCircle.rotation.x = -Math.PI / 2;
  innerCircle.position.y = 0.03;
  innerCircle.scale.set(config.INFIELD_SCALE_X, config.INFIELD_SCALE_Z, 1.0);
  scene.add(innerCircle);

  const pitchGeo = new THREE.PlaneGeometry(3.5, 22);
  const pitchMat = new THREE.MeshStandardMaterial({ map: pitchTexture, roughness: 0.9, metalness: 0.0 });
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.02, (config.stumpSettings.posZ_striker + config.stumpSettings.posZ_bowler) / 2);
  pitch.receiveShadow = true;
  scene.add(pitch);

  function createCrowdTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#333';
    for (let y = 0; y < 512; y += 32) { ctx.fillRect(0, y, 1024, 20); }
    const colors = ['#e57373','#81c784','#64b5f6','#fff176','#a1887f','#90a4ae','#ffffff'];
    for (let y = 10; y < 512; y += 32) {
      for (let x = 0; x < 1024; x += 12) {
        if (Math.random() > 0.15) {
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          const pSize = 6 + Math.random() * 4;
          ctx.fillRect(x, y, pSize, pSize);
          ctx.fillRect(x + 2, y - 4, 4, 4);
        }
      }
    }
    for (let i = 0; i < 15; i++) {
      const bx = Math.random() * 1024; const by = Math.floor(Math.random() * 16) * 32;
      ctx.fillStyle = Math.random() > 0.5 ? '#d32f2f' : '#1976d2';
      ctx.fillRect(bx, by, 40, 15);
      ctx.fillStyle = 'white'; ctx.font = 'bold 10px Arial'; ctx.fillText('INDIA', bx + 5, by + 12);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(0,0,0,0.4)'); grad.addColorStop(0.1, 'rgba(0,0,0,0)');
    grad.addColorStop(0.9, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(12, 1);
    return texture;
  }

  const crowdTexture = createCrowdTexture();
  const stadiumGroup = new THREE.Group();

  const moatGeo = new THREE.RingGeometry(config.BOUNDARY_R + 15, config.BOUNDARY_R + 40, 64);
  const moatMat = new THREE.MeshStandardMaterial({ color: config.colors.moatColor, roughness: 0.8 });
  const moat = new THREE.Mesh(moatGeo, moatMat);
  moat.rotation.x = -Math.PI / 2; moat.position.y = 0.1; scene.add(moat);

  const lowerTierGeo = new THREE.CylinderGeometry(config.BOUNDARY_R + 55, config.BOUNDARY_R + 40, 20, 64, 1, true);
  const lowerTierMat = new THREE.MeshStandardMaterial({ map: crowdTexture, side: THREE.BackSide, roughness: 0.9 });
  const lowerTier = new THREE.Mesh(lowerTierGeo, lowerTierMat);
  lowerTier.position.y = 10; stadiumGroup.add(lowerTier);

  const upperTierGeo = new THREE.CylinderGeometry(config.BOUNDARY_R + 85, config.BOUNDARY_R + 65, 25, 64, 1, true);
  const upperTierMat = new THREE.MeshStandardMaterial({ map: crowdTexture, side: THREE.BackSide, roughness: 0.9 });
  const upperTier = new THREE.Mesh(upperTierGeo, upperTierMat);
  upperTier.position.y = 32; stadiumGroup.add(upperTier);

  const rimGeo = new THREE.TorusGeometry(config.BOUNDARY_R + 85, 3, 8, 64);
  const rimMat = new THREE.MeshStandardMaterial({ color: config.colors.stadiumColor });
  const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2;
  rim.position.y = 44.5; stadiumGroup.add(rim);
  scene.add(stadiumGroup);

  function createFloodlight(x, z, rotation) {
    const lightGroup = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.5, 60, 8), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    pole.position.y = 30; lightGroup.add(pole);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffffff, emissiveIntensity: 0.5 }));
    panel.position.set(0, 60, 2); panel.rotation.x = Math.PI / 6; lightGroup.add(panel);
    lightGroup.position.set(x, 0, z); lightGroup.rotation.y = rotation;
    return lightGroup;
  }
  const fDist = config.BOUNDARY_R + 80;
  const f1 = createFloodlight(fDist, fDist, -Math.PI / 4);
  const f2 = createFloodlight(-fDist, fDist, Math.PI / 4);
  const f3 = createFloodlight(fDist, -fDist, -Math.PI * 0.75);
  const f4 = createFloodlight(-fDist, -fDist, Math.PI * 0.75);
  scene.add(f1, f2, f3, f4);
  lights.floodlights.push(f1, f2, f3, f4);

  const ss = new THREE.Mesh(new THREE.PlaneGeometry(15, 12), new THREE.MeshStandardMaterial({ color: config.colors.boundaryColor, roughness: 1.0 }));
  ss.position.set(0, 6, -config.BOUNDARY_R - 5); scene.add(ss);

  function createStumps(zPos) {
    const { scale, spacing, color } = config.stumpSettings;
    const stumpsGroup = new THREE.Group();
    const stumpGeo = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 1.2 * scale, 12);
    const stumpMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
    for (let i = -1; i <= 1; i++) {
      const stump = new THREE.Mesh(stumpGeo, stumpMat);
      stump.position.set(i * spacing * scale, 0.6 * scale, 0);
      stump.castShadow = true; stumpsGroup.add(stump);
    }
    stumpsGroup.position.set(0, 0, zPos);
    return stumpsGroup;
  }
  scene.add(createStumps(config.stumpSettings.posZ_striker));
  scene.add(createStumps(config.stumpSettings.posZ_bowler));

  // ─── Shared geometry for humanoids ────────────────────────────────────────
  const bodyGeo  = new THREE.CapsuleGeometry(0.25, 0.7, 4, 16);
  const headGeo  = new THREE.SphereGeometry(0.22, 16, 16);
  const limbGeo  = new THREE.CylinderGeometry(0.08, 0.06, 0.6, 8);
  const capGeo   = new THREE.CylinderGeometry(0.23, 0.23, 0.1, 16);
  const brimGeo  = new THREE.BoxGeometry(0.2, 0.02, 0.3);
  const headMat  = new THREE.MeshStandardMaterial({ color: 0xFFCC99, roughness: 0.9 });

  function buildHumanoid(jerseyColor, pantsColor, helmetColor, addPads) {
    const group = new THREE.Group();
    const jersey = new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.7 });
    const pants  = new THREE.MeshStandardMaterial({ color: pantsColor,  roughness: 0.8 });

    const body = new THREE.Mesh(bodyGeo, jersey); body.position.y = 1.2; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(headGeo, headMat); head.position.y = 1.85; head.castShadow = true; group.add(head);
    const cap  = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.6 }));
    cap.position.y = 2.03; group.add(cap);
    const brim = new THREE.Mesh(brimGeo, new THREE.MeshStandardMaterial({ color: helmetColor }));
    brim.position.set(0, 2.0, 0.2); group.add(brim);
    const lArm = new THREE.Mesh(limbGeo, headMat); lArm.position.set(-0.35, 1.3, 0); lArm.rotation.z = Math.PI / 8; group.add(lArm);
    const rArm = new THREE.Mesh(limbGeo, headMat); rArm.position.set(0.35, 1.3, 0); rArm.rotation.z = -Math.PI / 8; group.add(rArm);
    const lLeg = new THREE.Mesh(limbGeo, pants); lLeg.position.set(-0.15, 0.3, 0); group.add(lLeg);
    const rLeg = new THREE.Mesh(limbGeo, pants); rLeg.position.set(0.15, 0.3, 0); group.add(rLeg);

    if (addPads) {
      // WK pads — two tall white boxes on front of legs
      const padGeo = new THREE.BoxGeometry(0.18, 0.7, 0.1);
      const padMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.6 });
      const lPad = new THREE.Mesh(padGeo, padMat); lPad.position.set(-0.15, 0.42, 0.08); group.add(lPad);
      const rPad = new THREE.Mesh(padGeo, padMat); rPad.position.set(0.15, 0.42, 0.08); group.add(rPad);
      // Gloves
      const gloveGeo = new THREE.CapsuleGeometry(0.1, 0.12, 4, 8);
      const gloveMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
      const lGlove = new THREE.Mesh(gloveGeo, gloveMat); lGlove.position.set(-0.42, 1.15, 0); group.add(lGlove);
      const rGlove = new THREE.Mesh(gloveGeo, gloveMat); rGlove.position.set(0.42, 1.15, 0); group.add(rGlove);
    }
    return group;
  }

  // ─── 9 Regular Fielders (blue) ────────────────────────────────────────────
  const fielders = [];
  for (let i = 0; i < 9; i++) {
    const f = buildHumanoid(0x1E88E5, 0x1565C0, 0x1E88E5, false);
    f.scale.set(config.FIELDER_SCALE, config.FIELDER_SCALE, config.FIELDER_SCALE);
    f.userData = { basePos: new THREE.Vector3(), isChasing: false };
    scene.add(f);
    fielders.push(f);
  }

  // ─── Bowler (opponent-coloured — set dynamically later, default red) ───────
  const bowler = buildHumanoid(0xE53935, 0x880000, 0xE53935, false);
  bowler.scale.set(config.FIELDER_SCALE, config.FIELDER_SCALE, config.FIELDER_SCALE);
  bowler.position.set(0, 0, config.bowlerSettings.runUpStartZ);
  bowler.userData = { role: 'bowler' };
  scene.add(bowler);

  // ─── Wicket Keeper (yellow gloves + pads, blue jersey) ───────────────────
  const wk = buildHumanoid(0x1E88E5, 0x1565C0, 0xFFEB3B, true);
  wk.scale.set(config.FIELDER_SCALE, config.FIELDER_SCALE, config.FIELDER_SCALE);
  // Behind striker stumps
  wk.position.set(0, 0, config.stumpSettings.wkPosZ);
  wk.userData = { role: 'wicketkeeper' };
  scene.add(wk);

  // ─── Bat ──────────────────────────────────────────────────────────────────
  const pivot = new THREE.Group();
  pivot.position.set(0, 1.8, 0);

  const { width, height, thickness, spineThickness, color, handleColor, stickerColor, gripRibs, pivotOffset } = config.batSettings;
  const batAssembly = new THREE.Group();
  batAssembly.position.y = pivotOffset || 0;
  pivot.add(batAssembly);

  const halfW = width / 2, faceZ = -spineThickness / 2, sideZ = faceZ + thickness, peakZ = spineThickness / 2;
  const batShape = new THREE.Shape();
  batShape.moveTo(-halfW, -faceZ); batShape.lineTo(halfW, -faceZ);
  batShape.lineTo(halfW, -sideZ); batShape.lineTo(0, -peakZ);
  batShape.lineTo(-halfW, -sideZ); batShape.lineTo(-halfW, -faceZ);
  const batGeo = new THREE.ExtrudeGeometry(batShape, { depth: height, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  const batMesh = new THREE.Mesh(batGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 }));
  batMesh.rotation.x = -Math.PI / 2; batMesh.castShadow = true; batAssembly.add(batMesh);

  const handleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 16), new THREE.MeshStandardMaterial({ color: handleColor, roughness: 0.8 }));
  handleMesh.position.set(0, -0.5, 0); batAssembly.add(handleMesh);
  for (let i = 0; i < gripRibs; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.01, 8, 16), new THREE.MeshStandardMaterial({ color: handleColor }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.1 - (i * 0.12); batAssembly.add(ring);
  }
  const gloveMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const bGlove = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.15, 4, 8), gloveMat); bGlove.position.set(0, -0.7, 0); batAssembly.add(bGlove);
  const tGlove = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.15, 4, 8), gloveMat); tGlove.position.set(0, -0.3, 0); batAssembly.add(tGlove);

  const mrfCanvas = document.createElement('canvas'); mrfCanvas.width = 128; mrfCanvas.height = 512;
  const mctx = mrfCanvas.getContext('2d');
  mctx.fillStyle = 'white'; mctx.fillRect(0,0,128,512);
  mctx.fillStyle = stickerColor; mctx.font = 'bold 100px Arial'; mctx.textAlign = 'center';
  mctx.save(); mctx.translate(64,256); mctx.rotate(-Math.PI/2); mctx.fillText('MRF',0,35); mctx.restore();
  mctx.fillStyle = '#333'; mctx.font = '30px Arial'; mctx.fillText('Genius',64,150); mctx.fillText('GRAND',64,380); mctx.fillText('EDITION',64,410);
  const mrfTex = new THREE.CanvasTexture(mrfCanvas);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(width*0.8, height*0.85), new THREE.MeshBasicMaterial({ map: mrfTex, transparent: true }));
  sticker.position.set(0, height/2+0.2, faceZ-0.002); batAssembly.add(sticker);
  const shoulderMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, spineThickness), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 }));
  shoulderMesh.position.set(0, 0, 0); batAssembly.add(shoulderMesh);
  scene.add(pivot);

  // ─── Ball ─────────────────────────────────────────────────────────────────
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.4, metalness: 0.1 }));
  ball.position.set(0, 0.2, -20); ball.castShadow = true; scene.add(ball);

  // ─── Bounce Marker ────────────────────────────────────────────────────────
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const bounceMarker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.45, 32), markerMat);
  bounceMarker.rotation.x = -Math.PI / 2; bounceMarker.position.y = 0.03; bounceMarker.visible = false; scene.add(bounceMarker);

  // ─── Guard Marker (X mark for batter position) ────────────────────────────
  const guardMarkerMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
  const guardGeo1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 0.02, -0.3), new THREE.Vector3(0.3, 0.02, 0.3)]);
  const guardGeo2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 0.02, 0.3), new THREE.Vector3(0.3, 0.02, -0.3)]);
  const guardLine1 = new THREE.Line(guardGeo1, guardMarkerMat);
  const guardLine2 = new THREE.Line(guardGeo2, guardMarkerMat);
  const guardMarker = new THREE.Group();
  guardMarker.add(guardLine1);
  guardMarker.add(guardLine2);
  scene.add(guardMarker);

  const setMatchAtmosphere = (format) => {
    switch(format) {
      case 'test':
        scene.background = new THREE.Color(0x87CEEB);
        lights.sunLight.intensity = 1.2;
        lights.sunLight.color.set(0xffffff);
        lights.hemiLight.intensity = 0.6;
        lights.floodlights.forEach(f => f.visible = false);
        ball.material.color.set(0xff0000); // Red ball
        break;
      case 'odi':
        scene.background = new THREE.Color(0xFFA07A); // Sunset
        lights.sunLight.intensity = 0.8;
        lights.sunLight.color.set(0xffd1a9);
        lights.hemiLight.intensity = 0.4;
        lights.floodlights.forEach(f => f.visible = false);
        ball.material.color.set(0xffffff); // White ball
        break;
      case 't20':
      case 'ipl':
        scene.background = new THREE.Color(0x87CEEB); // Back to Day
        lights.sunLight.intensity = 1.1;
        lights.sunLight.color.set(0xffffff);
        lights.hemiLight.intensity = 0.5;
        lights.floodlights.forEach(f => f.visible = false);
        ball.material.color.set(0xffffff); // White ball
        break;
    }
  };

  const updatePlayerKits = (format) => {
    const isTest = format === 'test';
    const jersey = isTest ? 0xEEEEEE : 0x1E88E5;
    const pants = isTest ? 0xEEEEEE : 0x1565C0;
    
    fielders.forEach(f => {
      f.children[0].material.color.set(jersey); // Body
      f.children[4].material.color.set(pants); // Leg
      f.children[5].material.color.set(pants); // Leg
    });
    
    // Wicketkeeper
    wk.children[0].material.color.set(jersey);
    wk.children[4].material.color.set(pants);
    wk.children[5].material.color.set(pants);
    
    // Bowler (Opponent)
    const oppJersey = isTest ? 0xEEEEEE : 0xE53935;
    bowler.children[0].material.color.set(oppJersey);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { 
    scene, camera, renderer, 
    bat: pivot, ball, bounceMarker, guardMarker,
    fielders, bowler, wicketkeeper: wk,
    setMatchAtmosphere, updatePlayerKits
  };
}

export function updateBallPosition(ball, zPos) {
  ball.position.z = zPos;
  ball.position.y = zPos < -10 ? 0.2 : zPos < -5 ? 1 : 1.5;
}

export function resetBall(ball) {
  ball.position.set(0, 0.2, -20);
}
