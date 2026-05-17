/**
 * CameraManager handles the initialization and lifecycle of the camera stream.
 */
export class CameraManager {
    constructor() {
        this.videoElement = document.createElement('video');
        this.videoElement.id = 'camera-feed';
        this.videoElement.style.display = 'none'; // Hidden by default, renderer will use it
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.stream = null;
        this.active = false;
    }

    async start() {
        if (this.active) return;
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const errorMsg = "CameraManager: navigator.mediaDevices.getUserMedia is not supported. " +
                           "This usually happens in insecure contexts (non-HTTPS). " +
                           "Please ensure you are using localhost or HTTPS.";
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320 },
                    height: { ideal: 240 },
                    facingMode: 'user'
                },
                audio: false
            });
            this.videoElement.srcObject = this.stream;
            this.active = true;
            console.log("CameraManager: Stream started");
            return this.videoElement;
        } catch (error) {
            console.error("CameraManager: Error accessing camera", error);
            this.active = false;
            throw error;
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
        this.active = false;
        console.log("CameraManager: Stream stopped");
    }

    getVideoElement() {
        return this.videoElement;
    }

    isActive() {
        return this.active;
    }
}
