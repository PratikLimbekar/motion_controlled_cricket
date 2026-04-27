export const config = {
  // Motion Controls
  ROTATION_SENSITIVITY: 1,
  POSITION_SCALE: 0.02,
  RETURN_DAMPING: 0.1,
  GYRO_DEADZONE: 0.1,
  MAX_EXPECTED_ACC: 40.0,

  // Teams
  indianXI: [
    "Rohit Sharma", "Shubman Gill", "Virat Kohli", "Shreyas Iyer", 
    "KL Rahul", "Hardik Pandya", "Ravindra Jadeja", "Axar Patel", 
    "Kuldeep Yadav", "Jasprit Bumrah", "Mohammed Siraj"
  ],

  // Delivery Settings
  deliverySettings: {
    pitchZMin: -11,    // Minimum pitch distance
    pitchZMax: 0.5,      // Maximum pitch distance
    pitchXMin: -0.5,   // Minimum horizontal pitch location
    pitchXMax: 1.3,    // Maximum horizontal pitch location
    spinXMax: 2.5,     // Maximum lateral spin drift AFTER bounce
    baseSpeed: 12,     // Minimum ball speed
    speedVariance: 8   // Additional random speed added
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

  // Field & Physics Rules
  BOUNDARY_R: 95,
  INFIELD_R: 27,
  INFIELD_SCALE_X: 1.2,
  INFIELD_SCALE_Z: 1.7,
  DEEP_R: 95 * 0.95, // Updated based on new BOUNDARY_R
  INNER_MAX: 25, // 27 - 2
  FIELDER_SPEED: 18.5, // Decreased speed
  FIELDER_SCALE: 1.5, // Increased size
  RUNNER_SPEED: 13, // Much slower than fielder sprint
  PITCH_LENGTH: 20.0, // Distance to run between wickets
  MAX_CATCH_HEIGHT: 7.6, // Maximum height fielders can catch
  CATCH_RADIUS_GROUND: 1.6,
  CATCH_RADIUS_AIR: 3.2,
  CATCH_PROB_AIR: 0.85,
  CATCH_PROB_GROUND: 0.95,

  // Default Fielder Roles (Base Angles & Radii)
  FIELDER_ROLES: [
    { name: 'Slip', angle: 302, r: 15 },
    { name: 'Gully', angle: 325, r: 25 * 0.58 },
    { name: 'Point', angle: 0, r: 25 * 0.88 },
    { name: 'Cover', angle: 38, r: 25 * 0.82 },
    { name: 'Mid Off', angle: 62, r: 25 * 0.78 },
    { name: 'Mid On', angle: 118, r: 25 * 0.78 },
    { name: 'Mid Wicket', angle: 142, r: 25 * 0.82 },
    { name: 'Square Leg', angle: 180, r: 25 * 0.88 },
    { name: 'Fine Leg', angle: 230, r: 25 * 0.58 }
  ]
};
