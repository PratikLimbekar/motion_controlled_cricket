export const config = {
  // Motion Controls
  ROTATION_SENSITIVITY: 1,
  POSITION_SCALE: 0.029,
  RETURN_DAMPING: 0.1,
  GYRO_DEADZONE: 0.1,
  MAX_EXPECTED_ACC: 50.0,

  // Hand-Tracked Bat Pivot
  batTranslation: {
    sensitivity: 0.01,              // How strongly linear acceleration moves the bat (direct, no lag)
    decayFactor: 0.92,              // Displacement decay per sensor packet (lower = snappier return)
    maxDisplacement: { x: 1.8, y: 1.4, z: 1.2 }, // Max travel from rest position (world units)
  },

  // Tournament Settings
  tournamentSettings: {
    matchesPerTeam: 14,
    oversPerMatch: 20,
    powerplayOvers: 6,
    minTargetRPO: 8.5,
    maxTargetRPO: 13.5
  },

  // Delivery Settings
  deliverySettings: {
    pitchZMin: -9,
    pitchZMax: 2,
    pitchXMin: -0.5,
    pitchXMax: 1,
    spinXMax: 3,
    baseSpeed: 24,
    speedVariance: 9
  },

  // Bowler Settings
  bowlerSettings: {
    runUpStartZ: -40,       // Where bowler starts their run-up
    releaseZ: -20,          // Z position at point of release (matches ballStartPosZ)
    runUpDuration: 2,     // seconds to complete run-up
    offsetOptions: [-0.45, -0.3, 0.3, 0.45], // X offsets (sides of crease)
  },

  // Bat Settings
  batSettings: {
    width: 0.38,
    height: 2.1,
    thickness: 0.06,
    spineThickness: 0.12,
    color: 0xE6C9A8,
    handleColor: 0xffffff,
    stickerColor: 0xd32f2f,
    gripRibs: 8,
    pivotOffset: 0.5 // Positive values move the bat UP relative to the hands
  },

  // Stump Settings
  stumpSettings: {
    posZ_striker: 4.5,
    posZ_bowler: -18.0,
    scale: 1.3,
    spacing: 0.22,
    color: 0xffcc00,
    wkPosZ: 4.5 + 4.5, // Moved further back (was +2.0)
  },

  // Colors & Aesthetics
  colors: {
    grassColor: '#1B5E20',
    grassMowColor: '#2E7D32',
    pitchColor: '#D2B48C',
    pitchMarkingColor: '#FFFFFF',
    moatColor: '#222222',
    boundaryColor: '#FFFFFF',
    stadiumColor: '#333333'
  },

  // Field & Physics Rules
  BOUNDARY_R: 150,
  INFIELD_R: 45,
  INFIELD_SCALE_X: 1.2,
  INFIELD_SCALE_Z: 1.7,
  DEEP_R: 150 * 0.95,
  INNER_MAX: 40,
  FIELDER_SPEED: 24.5,
  FIELDER_SCALE: 1.5,
  RUNNER_SPEED: 7.5,
  PITCH_LENGTH: 20.0,

  // 9 Regular Fielder Roles (bowler + wicketkeeper are separate)
  FIELDER_ROLES: [
    { name: 'Slip', angle: 302, r: 18 },
    { name: 'Gully', angle: 325, r: 45 * 0.58 },
    { name: 'Point', angle: 0, r: 45 * 0.88 },
    { name: 'Cover', angle: 38, r: 45 * 0.82 },
    { name: 'Mid Off', angle: 62, r: 45 * 0.78 },
    { name: 'Mid On', angle: 118, r: 45 * 0.78 },
    { name: 'Mid Wicket', angle: 142, r: 45 * 0.82 },
    { name: 'Square Leg', angle: 180, r: 45 * 0.88 },
    { name: 'Fine Leg', angle: 230, r: 45 * 0.58 }
  ],

  // Camera Settings
  cameraSettings: {
    followDistance: 22,
    followHeight: 9,
    loftFactor: 1.4,
    lerpSpeed: 0.1,
    lookAtLerp: 0.1,
    batsmanCamPos: { x: 0, y: 5, z: 10 },
    batsmanLookAt: { x: 0, y: 1.5, z: -5 }
  },

  // Shot Mode Settings
  shotSettings: {
    loftLiftBonus: 0.8,       // extra Y added to shot velocity for loft
    loftMinY: 0.3,            // minimum upward component for loft
    strokeMaxY: 0.02,         // flatter strokes
    strokeSpeedBonus: 1.05,   // speed bonus for clean strokes
    defaultPowerPenalty: 0.5 // power multiplier when no mode active
  },

  // Physics & Gameplay Tuning
  physics: {
    gravity: 9.8 * 2.2,
    ballRadius: 0.2,
    hitboxMultiplier: 4,    // Highly forgiving hitbox
    edgeForgiveness: 0.7,    // Penalty on edges is minimal
    edgeThreshold: 0.9,
    powerBoost: 1.3,
    baseShotSpeed: 10,
    maxExtraShotSpeed: 40,
    bounceFactor: -0.38,
    friction: 0.96,
    bowledXThreshold: 0.45,
    bowledYThreshold: 1.4,
    hitGracePeriod: 50
  },

  // Environment Positions
  environment: {
    restPosition: { x: -0.8, y: 1, z: 1.0 },
    releaseHeight: 1.8,
    groundHeight: 0.2,
    battingHeight: 1.4,
    ballStartPosZ: -20
  },

  // Fielder Behavior Tuning
  fielderTuning: {
    catchRadiusGround: 3.2,
    catchRadiusAir: 5.0,
    maxCatchHeight: 6.5,
    catchProbAir: 0.95,
    catchProbGround: 0.99,
    fumbleProbability: 0.1,
    fumbleSpeedPenalty: 0.15,
    fumbleDuration: 600,
    lookAheadTime: 0.8,
    boundaryMargin: 2.0,
    reactionTimeRange: { min: 0.05, max: 0.25 },
    visionConeThreshold: 0.4,
    accelerationFactor: 0.08,
    commitDuration: 0.4,
    interceptBias: 0.15,
    gatheringWaitTime: 0.45,
    skills: {
      slip: { speed: 0.9, reaction: 1.5, catching: 1.2, aggression: 1.1 },
      infield: { speed: 1.1, reaction: 1.1, catching: 1.0, aggression: 1.3 },
      outfield: { speed: 1.3, reaction: 0.8, catching: 0.9, aggression: 1.0 }
    }
  },

  // Career Mode Format Settings
  formatSettings: {
    test: {
      swingMult: 1.3,
      aiVariationFreq: 0.15,
      channelBowling: 0.8,
      powerplay: { deep: 0, inner: 9 } // Attacking slips
    },
    odi: {
      swingMult: 1.0,
      aiVariationFreq: 0.35,
      channelBowling: 0.5,
      powerplay: { deep: 2, inner: 7 } // Standard P1
    },
    t20: {
      swingMult: 1.0,
      aiVariationFreq: 0.65,
      channelBowling: 0.3,
      powerplay: { deep: 2, inner: 7 }
    },
    ipl: {
      swingMult: 1.0,
      aiVariationFreq: 0.65,
      channelBowling: 0.3,
      powerplay: { deep: 2, inner: 7 }
    }
  },

  // Camera Tracking Settings
  cameraTracking: {
    smoothing: 0.5,         // EMA alpha — higher = more responsive (0=frozen, 1=raw)
    leadHand: 'left',       // 'left' or 'right'
    mirror: true,           // Flip X axis for front-facing camera
    poseEveryNFrames: 1,    // Running at 1 provides consistent frame pacing, avoiding stutter/judder.
    visualizeSkeleton: true,
    scale: { x: 5, y: 3, z: 5 },
    offset: { x: 0, y: 1.5, z: 0 },
    avatar: {
      color: 0x2F7594,      // Color of the stick figure
      jointSize: 0.08,      // Size of the joints (spheres)
      boneWidth: 3          // Width of the bones (lines) - note: WebGL lines are often always 1px
    }
  }
};
