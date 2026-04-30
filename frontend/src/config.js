export const config = {
  // Motion Controls
  ROTATION_SENSITIVITY: 1,
  POSITION_SCALE: 0.02,
  RETURN_DAMPING: 0.1,
  GYRO_DEADZONE: 0.1,
  MAX_EXPECTED_ACC: 50.0,

  // Teams
  indianXI: [
    "Rohit Sharma", "Shubman Gill", "Virat Kohli", "Shreyas Iyer", 
    "KL Rahul", "Hardik Pandya", "Ravindra Jadeja", "Axar Patel", 
    "Kuldeep Yadav", "Jasprit Bumrah", "Mohammed Siraj"
  ],

  // Delivery Settings
  deliverySettings: {
    pitchZMin: -11,    // Minimum pitch distance
    pitchZMax: 1.5,      // Maximum pitch distance
    pitchXMin: -0.5,   // Minimum horizontal pitch location
    pitchXMax: 1.3,    // Maximum horizontal pitch location
    spinXMax: 4.5,     // Maximum lateral spin drift AFTER bounce
    baseSpeed: 18,     // Minimum ball speed
    speedVariance: 12   // Additional random speed added
  },
  
  // Bat Settings
  batSettings: {
    width: 0.42,
    height: 3.2,
    thickness: 0.06, // Side thickness
    spineThickness: 0.16, // Total thickness at spine peak
    color: 0xE6C9A8,
    handleColor: 0xffffff,
    stickerColor: 0xd32f2f,
    gripRibs: 8
  },

  // Stump Settings
  stumpSettings: {
    posZ_striker: 4.5, // Pushed towards +ve Z
    posZ_bowler: -18.0,
    scale: 1.2,
    spacing: 0.22,
    color: 0xffcc00
  },

  // Colors & Aesthetics
  colors: {
    grassColor: '#1B5E20',    // Dark, professional green
    grassMowColor: '#2E7D32', // Slightly lighter for mowing stripes
    pitchColor: '#D2B48C',
    pitchMarkingColor: '#FFFFFF',
    moatColor: '#222222',
    boundaryColor: '#FFFFFF',
    stadiumColor: '#333333'
  },

  // Field & Physics Rules
  BOUNDARY_R: 140, // Scaled up ground
  INFIELD_R: 45,  // Scaled up infield
  INFIELD_SCALE_X: 1.2,
  INFIELD_SCALE_Z: 1.7,
  DEEP_R: 140 * 0.95, 
  INNER_MAX: 40, 
  FIELDER_SPEED: 34.5, // Increased speed for larger ground coverage
  FIELDER_SCALE: 1.5,
  RUNNER_SPEED: 10, 
  PITCH_LENGTH: 20.0,

  // Default Fielder Roles (Base Angles & Radii)
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
    followDistance: 22, // Pushed back for better field view
    followHeight: 9,   // Higher for overview
    loftFactor: 1.4,   // More aggressive zoom for lofted shots
    lerpSpeed: 0.1,
    lookAtLerp: 0.1,
    batsmanCamPos: { x: 0, y: 5, z: 10 },
    batsmanLookAt: { x: 0, y: 1.5, z: -5 }
  },

  // Physics & Gameplay Tuning
  physics: {
    gravity: 9.8 * 2.2, // Slightly higher for snappier ball movement
    ballRadius: 0.2,
    hitboxMultiplier: 2.2, // More forgiving hits
    edgeForgiveness: 0.45,
    powerBoost: 1.2,
    baseShotSpeed: 10,
    maxExtraShotSpeed: 55,
    bounceFactor: -0.38,
    friction: 0.96,
    bowledXThreshold: 0.45,
    bowledYThreshold: 1.4,
    hitGracePeriod: 120 // ms
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
    maxCatchHeight: 8.5,   
    catchProbAir: 0.95,
    catchProbGround: 0.99,
    fumbleProbability: 0.1,
    fumbleSpeedPenalty: 0.15, 
    fumbleDuration: 600,
    lookAheadTime: 0.8,
    boundaryMargin: 2.0,

    // NEW HUMAN-LIKE AI PARAMETERS
    reactionTimeRange: { min: 0.05, max: 0.25 }, // Seconds
    visionConeThreshold: 0.4, // Dot product threshold (1.0 = strict, -1.0 = blind)
    accelerationFactor: 0.08, // How quickly they reach top speed (0-1)
    commitDuration: 0.4, // Seconds they lock onto a target direction
    interceptBias: 0.15, // How much they lead the ball (0 = chase, 1 = extreme intercept)
    gatheringWaitTime: 0.45, // Seconds they wait before throwing back
    
    // Role-based Skill Multipliers
    skills: {
      slip:    { speed: 0.9, reaction: 1.5, catching: 1.2, aggression: 1.1 },
      infield: { speed: 1.1, reaction: 1.1, catching: 1.0, aggression: 1.3 },
      outfield:{ speed: 1.3, reaction: 0.8, catching: 0.9, aggression: 1.0 }
    }
  }
};
