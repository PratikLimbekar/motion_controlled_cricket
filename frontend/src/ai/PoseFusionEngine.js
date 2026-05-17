import * as THREE from 'three';
import { config } from '../config.js';

/**
 * PoseFusionEngine fuses camera-based body tracking with phone-based bat tracking.
 */
export class PoseFusionEngine {
    constructor() {
        this.bodyPose = null;
        this.batOrientation = new THREE.Quaternion().identity();
        this.batPosition = new THREE.Vector3();
        this.fusedBatTransform = {
            position: new THREE.Vector3(),
            quaternion: new THREE.Quaternion()
        };
        
        // Configuration
        this.smoothingFactor = config.cameraTracking.smoothing || 0.5; // higher = more responsive, less smooth
        this.mirrored = config.cameraTracking.mirror !== false;
        this.scale = config.cameraTracking.scale || { x: 5, y: 3, z: 5 };
        
        // This offset purely centers the user's physical stance to the origin (0,0,0)
        this.calibrationOffset = new THREE.Vector3(0, 0, 0);
        this.referenceWrist = new THREE.Vector3();
        
        // Expose total offset for AvatarRenderer
        this.offset = new THREE.Vector3();
    }

    calibrate(landmarks) {
        if (!landmarks) return;
        const leftW = landmarks.leftWrist;
        const rightW = landmarks.rightWrist;
        const midWrist = {
            x: (leftW.x + rightW.x) / 2,
            y: (leftW.y + rightW.y) / 2,
            z: (leftW.z + rightW.z) / 2
        };
        
        // Calculate where the wrist currently is in normalized space
        const normX = this.mirrored ? (0.5 - midWrist.x) : (midWrist.x - 0.5);
        const currX = normX * this.scale.x;
        const currY = (1 - midWrist.y) * this.scale.y;
        const currZ = midWrist.z * this.scale.z;

        // The calibration offset purely zeroes out the user's current stance
        this.calibrationOffset.x = -currX;
        this.calibrationOffset.y = -currY;
        this.calibrationOffset.z = -currZ;
        
        console.log("PoseFusionEngine: Recalibrated stance offset to", this.calibrationOffset);
    }

    // Removed setLeadHand since tracking is dynamic

    /**
     * Fuses body landmarks and phone sensor data.
     * @param {Object} landmarks - Landmarks from PoseEstimator
     * @param {THREE.Quaternion} phoneQuat - Orientation from phone sensor
     * @param {THREE.Vector3} restPosition - Default rest position of bat
     */
    fuse(landmarks, phoneQuat, restPosition) {
        if (!landmarks) {
            // Fallback: Use only phone data at rest position
            this.fusedBatTransform.position.copy(restPosition);
            this.fusedBatTransform.quaternion.copy(phoneQuat);
            return this.fusedBatTransform;
        }

        const leftW = landmarks.leftWrist;
        const rightW = landmarks.rightWrist;
        const midWrist = {
            x: (leftW.x + rightW.x) / 2,
            y: (leftW.y + rightW.y) / 2,
            z: (leftW.z + rightW.z) / 2
        };
        
        // Update the exposed total offset so AvatarRenderer knows where to draw
        this.offset.copy(this.calibrationOffset).add(restPosition);
        
        // 1. Map 2D/3D landmarks to world coordinates
        const normX = this.mirrored ? (0.5 - midWrist.x) : (midWrist.x - 0.5);
        const worldX = normX * this.scale.x + this.offset.x;
        
        const worldY = (1 - midWrist.y) * this.scale.y + this.offset.y;
        const worldZ = midWrist.z * this.scale.z + this.offset.z;
        
        const wristPos = new THREE.Vector3(worldX, worldY, worldZ);

        // 2. Apply smoothing (EMA)
        this.fusedBatTransform.position.lerp(wristPos, this.smoothingFactor);
        this.fusedBatTransform.quaternion.slerp(phoneQuat, this.smoothingFactor);

        return this.fusedBatTransform;
    }

    getFusedTransform() {
        return this.fusedBatTransform;
    }
}
