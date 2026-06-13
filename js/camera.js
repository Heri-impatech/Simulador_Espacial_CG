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
        // Conversão: Sistema de Coordenadas Esféricas -> Cartesianas
        const r = Math.max(1e-3, this.radius);
        const sinPhi = Math.sin(this.phi);
        const ex = r * sinPhi * Math.cos(this.theta);
        const ey = r * Math.cos(this.phi);
        const ez = r * sinPhi * Math.sin(this.theta);
        window.vec3.set(this.eye, ex, ey, ez);

        // Construção da View Matrix (Matriz de Visualização Look-At)
        window.mat4.lookAt(this.viewMatrix, this.eye, this.center, this.up);

        // Construção da Projection Matrix (Matriz de Projeção Perspectiva)
        const aspect = Math.max(0.0001, this.canvas.width / this.canvas.height);
        window.mat4.perspective(this.projectionMatrix, this.fov, aspect, this.near, this.far);

        // Matriz Combinada Global: ViewProj = Projection * View
        window.mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);
    }

    initEvents() {
        const canvas = this.canvas;
        
        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Garante processamento apenas com clique esquerdo
            
            // Impede ativação indesejada se clicar em botões da barra HUD flutuante lateral
            const hudPanel = document.getElementById('hud-panel');
            if (hudPanel && e.target && hudPanel.contains(e.target)) return;

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

            // Incremento e sensibilidade angular para rotação orbital contínua
            this.theta -= dx * 0.005;
            this.phi   -= dy * 0.005;
            this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
            this.updateMatrices();
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = Math.sign(e.deltaY);
            // Zoom exponencial balanceado para simular aproximação astronômica
            this.radius *= (1 + delta * 0.08);
            this.radius = Math.max(10, Math.min(3000, this.radius));
            this.updateMatrices();
        }, { passive: false });
    }

    /**
     * Projeta um ponto 3D para as coordenadas bidimensionais de pixels da viewport do Canvas.
     * Mapeia do Espaço do Mundo -> Espaço de Recorte -> Espaço NDC -> Viewport de Pixels.
     */
    projectPoint(point3D) {
        // Criação de vetor homogêneo de quatro dimensões [X, Y, Z, 1.0]
        const v4 = window.vec4.fromValues(point3D[0], point3D[1], point3D[2], 1);
        const clip = window.vec4.create();
        
        // Aplicação da transformação linear combinada global
        window.vec4.transformMat4(clip, v4, this.viewProjMatrix);

        const w = clip[3];
        if (!isFinite(w) || Math.abs(w) < 1e-9) return null;

        // Clipping Plane Frontal: Se W for menor ou igual a zero, está posicionado atrás da câmera
        if (w <= 0) return null;

        // Divisão Perspectiva Clássica de Computação Gráfica para Normalização NDC [-1, 1]
        const ndcX = clip[0] / w;
        const ndcY = clip[1] / w;
        const ndcZ = clip[2] / w;

        // Frustum Culling em Espaço NDC: descarta se o ponto estiver completamente fora das bordas da tela
        if (ndcX < -1.1 || ndcX > 1.1 || ndcY < -1.1 || ndcY > 1.1 || ndcZ < -1.0 || ndcZ > 1.0) {
            return null;
        }

        // Mapeamento de Viewport (Conversão de coordenadas NDC para os pixels físicos reais da tela)
        const sx = (ndcX * 0.5 + 0.5) * this.canvas.width;
        const sy = (1.0 - (ndcY * 0.5 + 0.5)) * this.canvas.height; // Inversão canônica do eixo Y cartesiano

        // CORREÇÃO MATEMÁTICA CRÍTICA: Alinha a escala de profundidade com o motor geométrico
        // Em vez de usar a distância esférica pura, usamos a compressão z linearizada do viewport
        const tmp = window.vec3.fromValues(point3D[0], point3D[1], point3D[2]);
        const depth = window.vec3.distance(this.eye, tmp);

        return { x: sx, y: sy, depth: depth };
    }
}

window.Camera3D = Camera3D;