import { CameraManager } from './CameraManager.js';
import { PoseEstimator } from './PoseEstimator.js';
import { StanceAnalyzer } from './StanceAnalyzer.js';
import { PoseFusionEngine } from './PoseFusionEngine.js';
import { CalibrationManager } from './CalibrationManager.js';
import { AvatarRenderer } from './AvatarRenderer.js';
import { config } from '../config.js';

/**
 * OptionalCameraController coordinates all camera-related modules.
 */
export class OptionalCameraController {
    constructor(scene) {
        this.cameraManager = new CameraManager();
        this.poseEstimator = new PoseEstimator();
        this.stanceAnalyzer = new StanceAnalyzer();
        this.poseFusionEngine = new PoseFusionEngine();
        this.calibrationManager = new CalibrationManager();
        this.avatarRenderer = new AvatarRenderer(scene);
        
        this.isEnabled = false;
        this.isInitialized = false;
        
        // Throttle pose estimation — only run every Nth frame to reduce pipeline load
        this._frameCount = 0;
        this._poseEveryNFrames = config.cameraTracking.poseEveryNFrames || 2;
        this._lastLandmarks = null;
    }

    async toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            await this.enable();
        }
    }

    async enable() {
        if (this.isEnabled) return;
        
        try {
            await this.cameraManager.start();
            await this.poseEstimator.init();
            this.isEnabled = true;
            this.avatarRenderer.setVisible(true);
            console.log("OptionalCameraController: Enabled");
        } catch (error) {
            console.error("OptionalCameraController: Failed to enable", error);
            this.isEnabled = false;
        }
    }

    disable() {
        this.cameraManager.stop();
        this.isEnabled = false;
        this.avatarRenderer.setVisible(false);
        this._lastLandmarks = null;
        console.log("OptionalCameraController: Disabled");
    }

    update(phoneQuat, restPosition) {
        if (!this.isEnabled) return null;

        // Maintain ring buffer of phone orientations for time-delay latency compensation
        if (!this.phoneHistory) {
            this.phoneHistory = [];
        }
        this.phoneHistory.push({
            timestamp: performance.now(),
            quat: phoneQuat.clone()
        });
        if (this.phoneHistory.length > 25) {
            this.phoneHistory.shift();
        }

        const video = this.cameraManager.getVideoElement();
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            this._frameCount++;

            // Only run the expensive pose estimation every N frames
            if (this._frameCount % this._poseEveryNFrames === 0) {
                const timestamp = performance.now();
                this.poseEstimator.estimatePose(video, timestamp);
                this._lastLandmarks = this.poseEstimator.getBattingLandmarks();
            }

            const landmarks = this._lastLandmarks;

            if (landmarks) {
                this.stanceAnalyzer.update(landmarks);
                
                // Fetch historically synchronized phone orientation (T - 35ms for MediaPipe lag)
                const targetTime = performance.now() - 35;
                let bestQuat = phoneQuat;
                let minDiff = Infinity;
                for (const entry of this.phoneHistory) {
                    const diff = Math.abs(entry.timestamp - targetTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestQuat = entry.quat;
                    }
                }

                const fused = this.poseFusionEngine.fuse(landmarks, bestQuat, restPosition);
                // Update the 3D avatar every frame for smooth visual even if pose only runs at 30fps
                this.avatarRenderer.update(landmarks, this.poseFusionEngine);
                return {
                    landmarks,
                    metrics: this.stanceAnalyzer.getMetrics(),
                    fusedTransform: fused
                };
            }
        }
        
        return null;
    }

    calibrate() {
        if (!this.isEnabled) return;
        this.calibrationManager.startCalibration(() => {
            const landmarks = this.poseEstimator.getBattingLandmarks();
            if (landmarks) {
                this.stanceAnalyzer.calibrate(landmarks);
                this.poseFusionEngine.calibrate(landmarks);
            }
        });
    }

    instantCalibrate() {
        if (!this.isEnabled) return;
        const landmarks = this.poseEstimator.getBattingLandmarks() || this._lastLandmarks;
        if (landmarks) {
            this.stanceAnalyzer.calibrate(landmarks);
            this.poseFusionEngine.calibrate(landmarks);
        }
    }

    isActive() {
        return this.isEnabled;
    }
}
