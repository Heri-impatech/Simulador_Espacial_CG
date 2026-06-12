/**
 * js/camera.js
 * Gestão de Projeção Perspectiva, Visualização e Sistema Orbital 3D
 */

class Camera3D {
    constructor(canvas) {
        this.canvas = canvas;

        this.radius = 550;
        this.theta = 0.5;
        this.phi = 0.8;

        this.minPhi = 0.01;
        this.maxPhi = Math.PI - 0.01;

        this.eye = window.vec3.create();
        this.center = window.vec3.fromValues(0, 0, 0);
        this.up = window.vec3.fromValues(0, 1, 0);

        this.viewMatrix = window.mat4.create();
        this.projectionMatrix = window.mat4.create();
        this.viewProjMatrix = window.mat4.create();

        this.fov = 60 * Math.PI / 180;
        this.near = 1;
        this.far = 2000;

        this.isDragging = false;
        this._lastMouse = { x: 0, y: 0 };

        this.updateMatrices();
        this.initEvents();
    }

    updateMatrices() {
        // Spherical -> Cartesian
        const r = Math.max(1e-3, this.radius);
        const sinPhi = Math.sin(this.phi);
        const ex = r * sinPhi * Math.cos(this.theta);
        const ey = r * Math.cos(this.phi);
        const ez = r * sinPhi * Math.sin(this.theta);
        window.vec3.set(this.eye, ex, ey, ez);

        // View
        window.mat4.lookAt(this.viewMatrix, this.eye, this.center, this.up);

        // Projection
        const aspect = Math.max(0.0001, this.canvas.width / this.canvas.height);
        window.mat4.perspective(this.projectionMatrix, this.fov, aspect, this.near, this.far);

        // viewProj
        window.mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);
    }

    initEvents() {
        const canvas = this.canvas;
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            this.isDragging = true;
            this._lastMouse.x = e.clientX;
            this._lastMouse.y = e.clientY;
            canvas.style.cursor = 'grabbing';
        });
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            canvas.style.cursor = 'default';
        });
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = (e.clientX - this._lastMouse.x);
            const dy = (e.clientY - this._lastMouse.y);
            this._lastMouse.x = e.clientX;
            this._lastMouse.y = e.clientY;

            // Sensitivities
            this.theta -= dx * 0.005;
            this.phi   -= dy * 0.005;
            this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
            this.updateMatrices();
        });
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = Math.sign(e.deltaY);
            this.radius *= (1 + delta * 0.08);
            this.radius = Math.max(10, Math.min(3000, this.radius));
            this.updateMatrices();
        }, { passive: false });
    }

    /**
     * Project a 3D point into screen coordinates.
     * Returns { x, y, depth } or null if behind near/far plane or clipped.
     */
    projectPoint(point3D) {
        // clip-space transform: vec4 -> clip
        const v4 = window.vec4.fromValues(point3D[0], point3D[1], point3D[2], 1);
        const clip = window.vec4.create();
        window.vec4.transformMat4(clip, v4, this.viewProjMatrix);

        const w = clip[3];
        if (!isFinite(w) || Math.abs(w) < 1e-9) return null;

        // If w <= 0 the point is typically behind the camera in this projection convention
        if (w <= 0) return null;

        const ndcX = clip[0] / w;
        const ndcY = clip[1] / w;
        const ndcZ = clip[2] / w;

        // Frustum culling in NDC space
        if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1 || ndcZ < -1 || ndcZ > 1) {
            return null;
        }

        const sx = (ndcX * 0.5 + 0.5) * this.canvas.width;
        const sy = (1 - (ndcY * 0.5 + 0.5)) * this.canvas.height;

        // Depth for ordering/scale: use view-space distance (distance from eye)
        const tmp = window.vec3.fromValues(point3D[0], point3D[1], point3D[2]);
        const depth = window.vec3.distance(this.eye, tmp);

        return { x: sx, y: sy, depth: depth };
    }
}

window.Camera3D = Camera3D;