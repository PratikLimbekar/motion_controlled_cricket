import * as THREE from 'three';
import { config } from '../config.js';

export function setupScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Lighting
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(50, 100, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.camera.left = -150;
  sunLight.shadow.camera.right = 150;
  sunLight.shadow.camera.top = 150;
  sunLight.shadow.camera.bottom = -150;
  scene.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x1B5E20, 0.6);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  // Ground Textures
  function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base green
    ctx.fillStyle = config.colors.grassColor;
    ctx.fillRect(0, 0, 512, 512);
    
    // Mowing patterns (Circular stripes)
    ctx.strokeStyle = config.colors.grassMowColor;
    ctx.lineWidth = 40;
    for (let r = 20; r < 512; r += 80) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Noise/Grass detail
    for (let i = 0; i < 15000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6); // More repetition for large field
    return texture;
  }

  function createPitchTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base dirt/clay color
    ctx.fillStyle = config.colors.pitchColor;
    ctx.fillRect(0, 0, 256, 512);
    
    // Wear marks (scuffing at ends)
    const grad = ctx.createRadialGradient(128, 450, 20, 128, 450, 100);
    grad.addColorStop(0, '#A08060');
    grad.addColorStop(1, 'rgba(210, 180, 140, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 50, 256, 412);
    
    // Crease Markings
    ctx.strokeStyle = config.colors.pitchMarkingColor;
    ctx.lineWidth = 6;
    
    // 1. Bowling Creases (back)
    ctx.beginPath();
    ctx.moveTo(20, 50); ctx.lineTo(236, 50); // Bowler end
    ctx.moveTo(20, 462); ctx.lineTo(236, 462); // Striker end
    ctx.stroke();

    // 2. Popping Creases (front)
    ctx.beginPath();
    ctx.moveTo(0, 80); ctx.lineTo(256, 80); 
    ctx.moveTo(0, 432); ctx.lineTo(256, 432); 
    ctx.stroke();

    // 3. Return Creases
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

  // Ground
  const planeGeometry = new THREE.PlaneGeometry(600, 600); // Larger plane
  const planeMaterial = new THREE.MeshStandardMaterial({ 
    map: grassTexture,
    roughness: 1.0,
    metalness: 0.0
  }); 
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);


  // Boundary Rope
  const boundaryGeo = new THREE.TorusGeometry(config.BOUNDARY_R, 0.4, 12, 128);
  const boundaryMat = new THREE.MeshStandardMaterial({ color: config.colors.boundaryColor });
  const boundary = new THREE.Mesh(boundaryGeo, boundaryMat);
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.y = 0.4;
  boundary.castShadow = true;
  boundary.receiveShadow = true;
  scene.add(boundary);

  // 30-Yard Circle (Oval)
  const innerCircleGeo = new THREE.RingGeometry(config.INFIELD_R - 0.4, config.INFIELD_R + 0.4, 64);
  const innerCircleMat = new THREE.MeshBasicMaterial({ color: config.colors.boundaryColor, side: THREE.DoubleSide, opacity: 0.5, transparent: true });
  const innerCircle = new THREE.Mesh(innerCircleGeo, innerCircleMat);
  innerCircle.rotation.x = -Math.PI / 2;
  innerCircle.position.y = 0.03;
  innerCircle.scale.set(config.INFIELD_SCALE_X, config.INFIELD_SCALE_Z, 1.0); 
  scene.add(innerCircle);

  // Pitch
  const pitchGeo = new THREE.PlaneGeometry(3.5, 22);
  const pitchMat = new THREE.MeshStandardMaterial({ 
    map: pitchTexture,
    roughness: 0.9,
    metalness: 0.0
  });
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.02, (config.stumpSettings.posZ_striker + config.stumpSettings.posZ_bowler) / 2);
  pitch.receiveShadow = true;
  scene.add(pitch);

  // Stadium Components
  function createCrowdTexture() {
    // ... (rest of function as before)
    const canvas = document.createElement('canvas');
    canvas.width = 1024; // Increased resolution for better detail
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // 1. Base tier background (Stadium concrete/seating color)
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 1024, 512);
    
    // 2. Draw "Seating Rows"
    ctx.fillStyle = '#333';
    for (let y = 0; y < 512; y += 32) {
      ctx.fillRect(0, y, 1024, 20); // The "bench" area
    }
    
    // 3. Draw "Spectators" (larger, clustered dots)
    const colors = ['#e57373', '#81c784', '#64b5f6', '#fff176', '#a1887f', '#90a4ae', '#ffffff'];
    for (let y = 10; y < 512; y += 32) {
      for (let x = 0; x < 1024; x += 12) {
        // Skip some spots for realism
        if (Math.random() > 0.15) {
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          // Draw a small "person" (head and body simplified)
          const pSize = 6 + Math.random() * 4;
          ctx.fillRect(x, y, pSize, pSize); // Body
          ctx.fillRect(x + 2, y - 4, 4, 4); // Head
        }
      }
    }
    
    // 4. Add "Banners" (occasional larger colorful blocks)
    for (let i = 0; i < 15; i++) {
       const bx = Math.random() * 1024;
       const by = Math.floor(Math.random() * 16) * 32;
       ctx.fillStyle = Math.random() > 0.5 ? '#d32f2f' : '#1976d2';
       ctx.fillRect(bx, by, 40, 15);
       ctx.fillStyle = 'white';
       ctx.font = 'bold 10px Arial';
       ctx.fillText('INDIA', bx + 5, by + 12);
    }
    
    // 5. Ambient Occlusion (Row shadows)
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(0,0,0,0.4)');
    grad.addColorStop(0.1, 'rgba(0,0,0,0)');
    grad.addColorStop(0.9, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(12, 1); // Adjusted repeat for better scale
    return texture;
  }

  const crowdTexture = createCrowdTexture();
  
  // Tiered Stadium (Bowl Shape for Depth)
  const stadiumGroup = new THREE.Group();
  
  // Moat
  const moatGeo = new THREE.RingGeometry(config.BOUNDARY_R + 15, config.BOUNDARY_R + 40, 64);
  const moatMat = new THREE.MeshStandardMaterial({ color: config.colors.moatColor, roughness: 0.8 });
  const moat = new THREE.Mesh(moatGeo, moatMat);
  moat.rotation.x = -Math.PI / 2;
  moat.position.y = 0.1;
  scene.add(moat);

  // Lower Tier (Sloped Bowl)
  const lowerTierGeo = new THREE.CylinderGeometry(config.BOUNDARY_R + 55, config.BOUNDARY_R + 40, 20, 64, 1, true); // Sloped outwards
  const lowerTierMat = new THREE.MeshStandardMaterial({ 
    map: crowdTexture,
    side: THREE.BackSide,
    roughness: 0.9
  });
  const lowerTier = new THREE.Mesh(lowerTierGeo, lowerTierMat);
  lowerTier.position.y = 10;
  stadiumGroup.add(lowerTier);

  // Upper Tier (Even more sloped for depth)
  const upperTierGeo = new THREE.CylinderGeometry(config.BOUNDARY_R + 85, config.BOUNDARY_R + 65, 25, 64, 1, true); // Sloped even more
  const upperTierMat = new THREE.MeshStandardMaterial({ 
    map: crowdTexture,
    side: THREE.BackSide,
    roughness: 0.9
  });
  const upperTier = new THREE.Mesh(upperTierGeo, upperTierMat);
  upperTier.position.y = 32;
  stadiumGroup.add(upperTier);
  
  // Roof / Rim
  const rimGeo = new THREE.TorusGeometry(config.BOUNDARY_R + 85, 3, 8, 64);
  const rimMat = new THREE.MeshStandardMaterial({ color: config.colors.stadiumColor });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 44.5;
  stadiumGroup.add(rim);

  scene.add(stadiumGroup);

  // Floodlights
  function createFloodlight(x, z, rotation) {
    const lightGroup = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(1, 1.5, 60, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 30;
    lightGroup.add(pole);

    const panelGeo = new THREE.PlaneGeometry(12, 8);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffffff, emissiveIntensity: 0.5 });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.y = 60;
    panel.position.z = 2;
    panel.rotation.x = Math.PI / 6;
    lightGroup.add(panel);

    lightGroup.position.set(x, 0, z);
    lightGroup.rotation.y = rotation;
    return lightGroup;
  }

  const fDist = config.BOUNDARY_R + 80;
  scene.add(createFloodlight(fDist, fDist, -Math.PI / 4));
  scene.add(createFloodlight(-fDist, fDist, Math.PI / 4));
  scene.add(createFloodlight(fDist, -fDist, -Math.PI * 0.75));
  scene.add(createFloodlight(-fDist, -fDist, Math.PI * 0.75));

  // Sight Screen
  const ssGeo = new THREE.PlaneGeometry(15, 12);
  const ssMat = new THREE.MeshStandardMaterial({ color: config.colors.boundaryColor, roughness: 1.0 });
  const ss = new THREE.Mesh(ssGeo, ssMat);
  ss.position.set(0, 6, -config.BOUNDARY_R - 5);
  scene.add(ss);

  // Stumps
  function createStumps(zPos) {
    const { scale, spacing, color } = config.stumpSettings;
    const stumpsGroup = new THREE.Group();
    const stumpGeo = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 1.2 * scale, 12); 
    const stumpMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.2 });
    
    for (let i = -1; i <= 1; i++) {
      const stump = new THREE.Mesh(stumpGeo, stumpMat);
      stump.position.set(i * spacing * scale, 0.6 * scale, 0); 
      stump.castShadow = true;
      stump.receiveShadow = true;
      stumpsGroup.add(stump);
    }
    
    stumpsGroup.position.set(0, 0, zPos);
    return stumpsGroup;
  }

  const strikerStumps = createStumps(config.stumpSettings.posZ_striker); 
  const bowlerStumps = createStumps(config.stumpSettings.posZ_bowler); 
  scene.add(strikerStumps);
  scene.add(bowlerStumps);

  // Fielders (9 fielders excluding bowler and keeper)
  const fielders = [];
  
  const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.7, 4, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1E88E5, roughness: 0.7 }); 
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1565C0, roughness: 0.8 }); 
  const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xFFCC99, roughness: 0.9 }); 
  const limbGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.6, 8);
  const capGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.1, 16);
  const brimGeo = new THREE.BoxGeometry(0.2, 0.02, 0.3);
  
  for (let i = 0; i < 9; i++) {
    const fielder = new THREE.Group();
    
    // Body
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.2;
    body.castShadow = true;
    body.receiveShadow = true;
    fielder.add(body);
    
    // Head
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.85;
    head.castShadow = true;
    fielder.add(head);

    // Cap
    const cap = new THREE.Mesh(capGeo, bodyMat);
    cap.position.y = 2.03;
    fielder.add(cap);
    const brim = new THREE.Mesh(brimGeo, bodyMat);
    brim.position.set(0, 2.0, 0.2);
    fielder.add(brim);

    // Arms
    const leftArm = new THREE.Mesh(limbGeo, headMat);
    leftArm.position.set(-0.35, 1.3, 0);
    leftArm.rotation.z = Math.PI / 8;
    fielder.add(leftArm);

    const rightArm = new THREE.Mesh(limbGeo, headMat);
    rightArm.position.set(0.35, 1.3, 0);
    rightArm.rotation.z = -Math.PI / 8;
    fielder.add(rightArm);

    // Legs
    const leftLeg = new THREE.Mesh(limbGeo, pantsMat);
    leftLeg.position.set(-0.15, 0.3, 0);
    fielder.add(leftLeg);

    const rightLeg = new THREE.Mesh(limbGeo, pantsMat);
    rightLeg.position.set(0.15, 0.3, 0);
    fielder.add(rightLeg);
    
    fielder.position.set(0, 0, 0); 
    fielder.scale.set(config.FIELDER_SCALE, config.FIELDER_SCALE, config.FIELDER_SCALE);
    scene.add(fielder);
    
    fielder.userData = {
      basePos: new THREE.Vector3(),
      isChasing: false
    };
    fielders.push(fielder);
  }

  // Bat Pivot (Hands/Handle area)
  const pivot = new THREE.Group();
  pivot.position.set(0, 1.8, 0); 

  // Bat Mesh (Blade with Spine)
  const { width, height, thickness, spineThickness, color, handleColor, stickerColor, gripRibs } = config.batSettings;
  const halfW = width / 2;
  const faceZ = -spineThickness / 2;
  const sideZ = faceZ + thickness;
  const peakZ = spineThickness / 2;

  const batShape = new THREE.Shape();
  batShape.moveTo(-halfW, -faceZ); // Flat face 
  batShape.lineTo(halfW, -faceZ);  // Flat face 
  batShape.lineTo(halfW, -sideZ);  // Side thickness
  batShape.lineTo(0, -peakZ);      // Spine Peak
  batShape.lineTo(-halfW, -sideZ); // Side thickness
  batShape.lineTo(-halfW, -faceZ); // back to start

  const extrudeSettings = { depth: height, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 };
  const batGeometry = new THREE.ExtrudeGeometry(batShape, extrudeSettings);
  const batMaterial = new THREE.MeshStandardMaterial({ 
    color: color,
    roughness: 0.5,
    metalness: 0.2
  }); 
  const batMesh = new THREE.Mesh(batGeometry, batMaterial);
  
  // Rotate and position: faceZ becomes world Z
  batMesh.rotation.x = -Math.PI / 2;
  batMesh.position.set(0, 0, 0); 
  batMesh.castShadow = true;
  batMesh.receiveShadow = true;
  pivot.add(batMesh);

  // Add Handle (White ribbed grip)
  const handleGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 16);
  const handleMat = new THREE.MeshStandardMaterial({ color: handleColor, roughness: 0.8 }); 
  const handleMesh = new THREE.Mesh(handleGeo, handleMat);
  handleMesh.position.set(0, -0.5, 0); // Handle goes DOWN from the blade
  handleMesh.castShadow = true;
  pivot.add(handleMesh);

  // Add ribbing to handle
  for (let i = 0; i < gripRibs; i++) {
    const ringGeo = new THREE.TorusGeometry(0.082, 0.01, 8, 16);
    const ring = new THREE.Mesh(ringGeo, handleMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.1 - (i * 0.12);
    pivot.add(ring);
  }

  // Gloves (Gripping the handle)
  const gloveGeo = new THREE.CapsuleGeometry(0.12, 0.15, 4, 8);
  const gloveMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  
  const bottomGlove = new THREE.Mesh(gloveGeo, gloveMat);
  bottomGlove.position.set(0, -0.7, 0);
  pivot.add(bottomGlove);

  const topGlove = new THREE.Mesh(gloveGeo, gloveMat);
  topGlove.position.set(0, -0.3, 0);
  pivot.add(topGlove);

  // Create MRF Texture
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0,0,128,512);
  ctx.fillStyle = stickerColor; ctx.font = 'bold 100px Arial'; ctx.textAlign = 'center';
  ctx.save(); ctx.translate(64, 256); ctx.rotate(-Math.PI/2); ctx.fillText('MRF', 0, 35); ctx.restore();
  ctx.fillStyle = '#333'; ctx.font = '30px Arial'; ctx.fillText('Genius', 64, 150);
  ctx.fillText('GRAND', 64, 380); ctx.fillText('EDITION', 64, 410);
  const mrfTexture = new THREE.CanvasTexture(canvas);

  // Add a sticker to define the "Blade" (Face)
  const stickerGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.85);
  const stickerMat = new THREE.MeshBasicMaterial({ map: mrfTexture, transparent: true });
  const stickerMesh = new THREE.Mesh(stickerGeo, stickerMat);
  stickerMesh.position.set(0, height / 2 + 0.2, faceZ - 0.002); // Exactly on the flat face
  pivot.add(stickerMesh);

  // Add sticker to the back (spine area)
  const backStickerGeo = new THREE.PlaneGeometry(width * 0.5, height * 0.4);
  const backSticker = new THREE.Mesh(backStickerGeo, stickerMat);
  backSticker.position.set(0, height * 0.7, peakZ + 0.001);
  pivot.add(backSticker);

  // Add handle-shoulder transition
  const shoulderGeo = new THREE.BoxGeometry(width, 0.2, spineThickness);
  const shoulderMesh = new THREE.Mesh(shoulderGeo, batMaterial);
  shoulderMesh.position.set(0, 0, 0);
  pivot.add(shoulderMesh);

  scene.add(pivot);

  // Ball (Sphere)
  const ballGeometry = new THREE.SphereGeometry(0.2, 16, 16);
  const ballMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff0000,
    roughness: 0.4,
    metalness: 0.1
  });
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.position.set(0, 0.2, -20);
  ball.castShadow = true;
  ball.receiveShadow = true;
  scene.add(ball);

  // Bounce Marker (circle on pitch showing where ball will land)
  const markerGeo = new THREE.RingGeometry(0.25, 0.45, 32);
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  const bounceMarker = new THREE.Mesh(markerGeo, markerMat);
  bounceMarker.rotation.x = -Math.PI / 2;
  bounceMarker.position.y = 0.03; // Just above pitch surface
  bounceMarker.visible = false;
  scene.add(bounceMarker);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, bat: pivot, ball, bounceMarker, fielders };
}

export function updateBallPosition(ball, zPos) {
  ball.position.z = zPos;
  // Simple hop logic to simulate pitch bounce
  if (zPos < -10) {
     ball.position.y = 0.2; // ground
  } else if (zPos < -5) {
     ball.position.y = 1; // bouncing up
  } else {
     ball.position.y = 1.5; // reaches waist height
  }
}

export function resetBall(ball) {
  ball.position.set(0, 0.2, -20);
}
