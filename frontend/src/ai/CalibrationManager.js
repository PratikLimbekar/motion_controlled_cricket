/**
 * CalibrationManager handles the calibration step for pose tracking.
 */
export class CalibrationManager {
    constructor() {
        this.isCalibrating = false;
        this.calibrationData = null;
        this.countdown = 0;
        this.onComplete = null;
    }

    startCalibration(onComplete) {
        this.isCalibrating = true;
        this.countdown = 3; // 3 seconds countdown
        this.onComplete = onComplete;
        console.log("CalibrationManager: Starting calibration...");
        
        const timer = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) {
                clearInterval(timer);
                this.isCalibrating = false;
                if (this.onComplete) this.onComplete();
            }
        }, 1000);
    }

    getCountdown() {
        return this.countdown;
    }

    isActive() {
        return this.isCalibrating;
    }
}
