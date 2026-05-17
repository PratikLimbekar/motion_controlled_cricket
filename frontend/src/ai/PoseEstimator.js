import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/**
 * PoseEstimator uses MediaPipe to detect body landmarks from video frames.
 */
export class PoseEstimator {
    constructor() {
        this.poseLandmarker = null;
        this.isLoaded = false;
        this.lastResults = null;
    }

    async init() {
        if (this.isLoaded) return;

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.isLoaded = true;
        console.log("PoseEstimator: MediaPipe Pose Landmarker loaded");
    }

    estimatePose(videoElement, timestamp) {
        if (!this.isLoaded || !this.poseLandmarker) return null;

        const results = this.poseLandmarker.detectForVideo(videoElement, timestamp);
        this.lastResults = results;
        return results;
    }

    getLandmarks() {
        if (!this.lastResults || !this.lastResults.landmarks || this.lastResults.landmarks.length === 0) {
            return null;
        }
        return this.lastResults.landmarks[0];
    }

    /**
     * Extracts specific landmarks needed for batting stance.
     * Nose: 0
     * Shoulders: 11 (left), 12 (right)
     * Elbows: 13 (left), 14 (right)
     * Wrists: 15 (left), 16 (right)
     * Hips: 23 (left), 24 (right)
     * Knees: 25 (left), 26 (right)
     */
    getBattingLandmarks() {
        const all = this.getLandmarks();
        if (!all) return null;

        return {
            nose: all[0],
            leftShoulder: all[11],
            rightShoulder: all[12],
            leftElbow: all[13],
            rightElbow: all[14],
            leftWrist: all[15],
            rightWrist: all[16],
            leftHip: all[23],
            rightHip: all[24],
            leftKnee: all[25],
            rightKnee: all[26]
        };
    }
}
