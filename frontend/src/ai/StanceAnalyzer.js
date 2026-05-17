/**
 * StanceAnalyzer computes batting stance metrics from pose landmarks.
 */
export class StanceAnalyzer {
    constructor() {
        this.metrics = {
            headPosition: { x: 0, y: 0 },
            shoulderRotation: 0,
            hipRotation: 0,
            frontFootMovement: 0,
            weightTransfer: 0 // -1 (back foot) to 1 (front foot)
        };
        this.basePose = null;
    }

    calibrate(landmarks) {
        if (!landmarks) return;
        this.basePose = JSON.parse(JSON.stringify(landmarks));
        
        const dx = landmarks.leftShoulder.x - landmarks.rightShoulder.x;
        const dy = landmarks.leftShoulder.y - landmarks.rightShoulder.y;
        const dz = landmarks.leftShoulder.z - landmarks.rightShoulder.z;
        this.calibSpan = Math.sqrt(dx*dx + dy*dy + dz*dz);
        this.calibMidY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
        
        console.log("StanceAnalyzer: Calibrated base pose with shoulder span", this.calibSpan);
    }

    update(landmarks) {
        if (!landmarks) return this.metrics;

        // 1. Head Position (normalized)
        this.metrics.headPosition = { x: landmarks.nose.x, y: landmarks.nose.y };

        // 2. Perspective & Translation calculation
        if (this.basePose && this.calibSpan) {
            const dx = landmarks.leftShoulder.x - landmarks.rightShoulder.x;
            const dy = landmarks.leftShoulder.y - landmarks.rightShoulder.y;
            const dz = landmarks.leftShoulder.z - landmarks.rightShoulder.z;
            const currentSpan = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // Perspective width scale (stepping forward increases scale, backward decreases it)
            const Sw = currentSpan / this.calibSpan;
            
            // Vertical movement (bending forward drives shoulders down in screen coordinates)
            const currentMidY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
            const Ty = currentMidY - this.calibMidY; 

            // Weight transfer & footwork classification
            let footwork = "STATIC";
            let wt = 0.0;

            if (Sw > 1.05 && Ty > 0.03) {
                footwork = "FRONT_FOOT";
                wt = 1.0;
            } else if (Sw < 0.95) {
                footwork = "BACK_FOOT";
                wt = -1.0;
            }

            this.metrics.weightTransfer = wt;
            this.metrics.frontFootMovement = wt;
            this.metrics.footwork = footwork;
        } else {
            this.metrics.weightTransfer = 0.0;
            this.metrics.frontFootMovement = 0.0;
            this.metrics.footwork = "STATIC";
        }

        return this.metrics;
    }

    getMetrics() {
        return this.metrics;
    }
}
