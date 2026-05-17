/**
 * PoseRenderer handles visualization of tracked landmarks.
 */
export class PoseRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '50%';
            this.canvas.style.right = '10px';
            this.canvas.style.transform = 'translateY(-50%) scaleX(-1)';
            this.canvas.style.width = '240px';
            this.canvas.style.height = '180px';
            this.canvas.style.border = '2px solid rgba(255,255,255,0.2)';
            this.canvas.style.borderRadius = '8px';
            this.canvas.style.backgroundColor = 'rgba(0,0,0,0.5)';
            this.canvas.style.zIndex = '1000';
            document.body.appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');
    }

    draw(landmarks) {
        if (!landmarks) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);
        
        // Background glow
        const glow = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, w);
        glow.addColorStop(0, 'rgba(79, 195, 247, 0.1)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = '#4FC3F7';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#4FC3F7';

        // Draw connections
        this.drawConnection(ctx, landmarks.leftShoulder, landmarks.rightShoulder, w, h);
        this.drawConnection(ctx, landmarks.leftShoulder, landmarks.leftElbow, w, h);
        this.drawConnection(ctx, landmarks.leftElbow, landmarks.leftWrist, w, h);
        this.drawConnection(ctx, landmarks.rightShoulder, landmarks.rightElbow, w, h);
        this.drawConnection(ctx, landmarks.rightElbow, landmarks.rightWrist, w, h);
        this.drawConnection(ctx, landmarks.leftShoulder, landmarks.leftHip, w, h);
        this.drawConnection(ctx, landmarks.rightShoulder, landmarks.rightHip, w, h);
        this.drawConnection(ctx, landmarks.leftHip, landmarks.rightHip, w, h);
        this.drawConnection(ctx, landmarks.leftHip, landmarks.leftKnee, w, h);
        this.drawConnection(ctx, landmarks.rightHip, landmarks.rightKnee, w, h);

        // Draw points with glow
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#fff';
        Object.values(landmarks).forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x * w, point.y * h, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.shadowBlur = 0;
    }

    drawConnection(ctx, p1, p2, w, h) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
    }

    setVisible(visible) {
        this.canvas.style.display = visible ? 'block' : 'none';
    }
}
