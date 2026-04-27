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

  // Ground
  const planeGeometry = new THREE.PlaneGeometry(500, 500);
  const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2E7D32,
    roughness: 0.8,
    metalness: 0.1
  }); 
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // Boundary Rope (Circular with thickness)
  const boundaryGeo = new THREE.TorusGeometry(config.BOUNDARY_R, 0.3, 12, 128);
  const boundaryMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const boundary = new THREE.Mesh(boundaryGeo, boundaryMat);
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.y = 0.3;
  boundary.castShadow = true;
  boundary.receiveShadow = true;
  scene.add(boundary);

  // 30-Yard Circle (Oval)
  const innerCircleGeo = new THREE.RingGeometry(26.8, 27.2, 64);
  const innerCircleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, opacity: 0.3, transparent: true });
  const innerCircle = new THREE.Mesh(innerCircleGeo, innerCircleMat);
  innerCircle.rotation.x = -Math.PI / 2;
  innerCircle.position.y = 0.03;
  innerCircle.scale.set(config.INFIELD_SCALE_X, config.INFIELD_SCALE_Z, 1.0); 
  scene.add(innerCircle);

  // Pitch
  const pitchGeo = new THREE.PlaneGeometry(3.5, 22);
  const pitchMat = new THREE.MeshStandardMaterial({ 
    color: 0xD2B48C,
    roughness: 0.9,
    metalness: 0.0
  });
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.02, (config.stumpSettings.posZ_striker + config.stumpSettings.posZ_bowler) / 2);
  pitch.receiveShadow = true;
  scene.add(pitch);

  // Stadium Walls (Simulated Crowd)
  const stadiumGeo = new THREE.CylinderGeometry(150, 160, 25, 64, 1, true);
  const stadiumMat = new THREE.MeshStandardMaterial({ 
    color: 0x444444,
    side: THREE.BackSide,
    roughness: 0.9
  });
  const stadium = new THREE.Mesh(stadiumGeo, stadiumMat);
  stadium.position.y = 12;
  scene.add(stadium);

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
