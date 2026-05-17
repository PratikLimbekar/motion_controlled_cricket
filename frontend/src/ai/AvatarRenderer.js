import * as THREE from 'three';
import { config } from '../config.js';

/**
 * AvatarRenderer renders a 3D stick figure in the Three.js scene.
 */
export class AvatarRenderer {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        this.nodes = {};
        this.lines = [];
        this.visible = false;

        this.initAvatar();
    }

    initAvatar() {
        const jointSize = config.cameraTracking.avatar ? config.cameraTracking.avatar.jointSize : 0.08;
        const color = config.cameraTracking.avatar ? config.cameraTracking.avatar.color : 0x4FC3F7;
        const boneWidth = config.cameraTracking.avatar ? config.cameraTracking.avatar.boneWidth : 1;

        const pointGeo = new THREE.SphereGeometry(jointSize, 8, 8);
        const pointMat = new THREE.MeshBasicMaterial({ color: color });

        const landmarks = [
            'nose', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
            'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee'
        ];

        landmarks.forEach(name => {
            const mesh = new THREE.Mesh(pointGeo, pointMat);
            mesh.visible = false;
            this.nodes[name] = mesh;
            this.group.add(mesh);
        });

        // Initialize lines (connections)
        const lineMat = new THREE.LineBasicMaterial({ color: color, linewidth: boneWidth });
        const connections = [
            ['leftShoulder', 'rightShoulder'],
            ['leftShoulder', 'leftElbow'],
            ['leftElbow', 'leftWrist'],
            ['rightShoulder', 'rightElbow'],
            ['rightElbow', 'rightWrist'],
            ['leftShoulder', 'leftHip'],
            ['rightShoulder', 'rightHip'],
            ['leftHip', 'rightHip'],
            ['leftHip', 'leftKnee'],
            ['rightHip', 'rightKnee']
        ];

        connections.forEach(([p1, p2]) => {
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
            const line = new THREE.Line(geo, lineMat);
            line.visible = false;
            this.lines.push({ line, p1, p2 });
            this.group.add(line);
        });
    }

    update(landmarks, fusionEngine) {
        if (!landmarks || !this.visible) {
            this.hide();
            return;
        }

        // Pull live config from the PoseFusionEngine so calibration is respected
        const scale   = fusionEngine.scale;
        const offset  = fusionEngine.offset;
        const mirrored = fusionEngine.mirrored;

        Object.keys(this.nodes).forEach(name => {
            const p = landmarks[name];
            if (p) {
                const normX = mirrored ? (0.5 - p.x) : (p.x - 0.5);
                const x = normX * scale.x + offset.x;
                const y = (1 - p.y) * scale.y + offset.y;
                const z = p.z  * scale.z + offset.z;

                this.nodes[name].position.set(x, y, z);
                this.nodes[name].visible = true;
            }
        });

        this.lines.forEach(item => {
            const p1 = this.nodes[item.p1];
            const p2 = this.nodes[item.p2];
            if (p1.visible && p2.visible) {
                const positions = item.line.geometry.attributes.position.array;
                positions[0] = p1.position.x;
                positions[1] = p1.position.y;
                positions[2] = p1.position.z;
                positions[3] = p2.position.x;
                positions[4] = p2.position.y;
                positions[5] = p2.position.z;
                item.line.geometry.attributes.position.needsUpdate = true;
                item.line.visible = true;
            }
        });
    }

    setVisible(visible) {
        this.visible = visible;
        if (!visible) this.hide();
    }

    hide() {
        Object.values(this.nodes).forEach(n => n.visible = false);
        this.lines.forEach(l => l.line.visible = false);
    }
}
