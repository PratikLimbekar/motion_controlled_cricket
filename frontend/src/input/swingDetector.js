import { getRecentMotion } from './motionBuffer.js';

const SWING_THRESHOLD = 28.0; 
const PEAK_SEARCH_WINDOW = 8; // Analyze roughly 130ms context window buffer
const COOLDOWN = 600; // ms
const MAX_EXPECTED_ACC = 40.0;

let lastSwingTime = 0;

export function detectSwing() {
  const now = performance.now();
  if (now - lastSwingTime < COOLDOWN) return null;

  const buffer = getRecentMotion();
  if (buffer.length < PEAK_SEARCH_WINDOW * 2) return null;

  let peakIndex = -1;
  let maxScore = 0;

  // Search recent frames to identify a peak over threshold
  for (let i = buffer.length - PEAK_SEARCH_WINDOW; i < buffer.length; i++) {
    const frame = buffer[i];
    if (frame.motionScore > SWING_THRESHOLD && frame.motionScore > maxScore) {
      maxScore = frame.motionScore;
      peakIndex = i;
    }
  }

  // A genuine peak should have at least a couple of trailing sample frames denoting a decay
  if (peakIndex !== -1 && peakIndex < buffer.length - 2) {
    const peakFrame = buffer[peakIndex];
    lastSwingTime = now;

    // Window size (approx 150ms / 9 frames at 60Hz)
    const windowStart = Math.max(0, peakIndex - 4);
    const windowEnd = Math.min(buffer.length - 1, peakIndex + 4);
    
    let sumX = 0, sumY = 0, sumZ = 0;
    for(let i = windowStart; i <= windowEnd; i++) {
        sumX += buffer[i].rawAcc[0];
        sumY += buffer[i].rawAcc[1];
        sumZ += buffer[i].rawAcc[2];
    }
    
    const sumMag = Math.sqrt(sumX*sumX + sumY*sumY + sumZ*sumZ) || 1.0;
    const direction_vector = [sumX/sumMag, sumY/sumMag, sumZ/sumMag];

    let peakAcc = 0;
    for(let i = windowStart; i <= windowEnd; i++) {
        if (buffer[i].accMag > peakAcc) peakAcc = buffer[i].accMag;
    }

    const power = Math.max(0.0, Math.min(1.0, peakAcc / MAX_EXPECTED_ACC));

    return {
      swing: true,
      power: power,
      direction_vector: direction_vector,
      timestamp: peakFrame.timestamp,
      motion_score: peakFrame.motionScore,
      acc_mag: peakFrame.accMag,
      gyro_mag: peakFrame.gyroMag
    };
  }

  return null;
}
