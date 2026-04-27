const BUFFER_SIZE = 60; // 60 frames ~ 1 sec @ 60Hz
const motionBuffer = [];

const ALPHA = 0.08; // Stronger low pass filter to eliminate jitter
const K_GYRO = 2.0;

let lastAcc = [0, 0, 0];
let lastGyro = [0, 0, 0];

export function addMotionData(rawAcc, rawGyro) {
  // Low-pass filter
  const acc = [
    ALPHA * rawAcc[0] + (1 - ALPHA) * lastAcc[0],
    ALPHA * rawAcc[1] + (1 - ALPHA) * lastAcc[1],
    ALPHA * rawAcc[2] + (1 - ALPHA) * lastAcc[2],
  ];
  const gyro = [
    ALPHA * rawGyro[0] + (1 - ALPHA) * lastGyro[0],
    ALPHA * rawGyro[1] + (1 - ALPHA) * lastGyro[1],
    ALPHA * rawGyro[2] + (1 - ALPHA) * lastGyro[2],
  ];

  lastAcc = acc;
  lastGyro = gyro;

  const accMag = Math.sqrt(acc[0]*acc[0] + acc[1]*acc[1] + acc[2]*acc[2]);
  const gyroMag = Math.sqrt(gyro[0]*gyro[0] + gyro[1]*gyro[1] + gyro[2]*gyro[2]);
  const motionScore = accMag + K_GYRO * gyroMag;

  motionBuffer.push({
    timestamp: performance.now(),
    rawAcc,
    acc,
    gyro,
    accMag,
    gyroMag,
    motionScore
  });

  if (motionBuffer.length > BUFFER_SIZE) {
    motionBuffer.shift();
  }
}

export function getRecentMotion() {
  return motionBuffer;
}
