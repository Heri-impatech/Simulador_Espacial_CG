/**
 * js/physics.js
 * Motor Físico de Dinâmica Orbital e Interações Gravitacionais N-Corpos
 */

class CelestialBody {
    constructor(x, y, z, radius, id) {
        this.id = id;
        this.pos = window.vec3.fromValues(x, y, z);
        this.vel = window.vec3.create();
        this.acc = window.vec3.create();

        // Garante que os corpos sejam visualmente proeminentes
        this.radius = Math.max(5, radius);
        
        // CORREÇÃO DE DENSIDADE: 0.002 mantém a simulação estável para raios grandes
        this.mass = Math.max(0.5, Math.pow(this.radius, 3) * 0.002);

        this.isRepelling = false;
        this.speedMultiplier = 1.0;
        
        // Rastreamento da Octree para a Aceleração de Fronteira
        this.lastNodeId = null;
        this.currentNodeId = null;
        this.pulseEffect = 0; // Efeito visual ao cruzar a malha

        this.color = this.generateCosmicColor();
    }

    generateCosmicColor() {
        if (this.radius > 30) return { r: 255, g: 140, b: 0 };  // Gigante Laranja
        if (this.radius > 20) return { r: 70, g: 150, b: 255 }; // Gigante Azul
        if (this.radius > 15) return { r: 220, g: 100, b: 100 };// Planeta Avermelhado
        
        // Corpos menores com variação espectral
        return {
            r: Math.floor(150 + Math.sin(this.id * 0.7) * 105),
            g: Math.floor(180 + Math.cos(this.id * 0.9) * 75),
            b: Math.floor(240 + Math.sin(this.id * 1.1) * 15)
        };
    }

    integrate(dt, boxSize) {
        // Euler semi-implícito: Atualiza velocidade
        window.vec3.scaleAndAdd(this.vel, this.vel, this.acc, dt);

        // Aceleração Dinâmica ao cruzar a fronteira da Octree
        if (this.lastNodeId && this.currentNodeId && this.lastNodeId !== this.currentNodeId) {
            window.vec3.scale(this.vel, this.vel, 1.015); // Aceleração súbita de 1.5%
            this.pulseEffect = 1.0; 
        }
        this.lastNodeId = this.currentNodeId;

        if (this.pulseEffect > 0) this.pulseEffect -= dt * 2.0;

        // Limite de velocidade para impedir que o estilingue gravitacional quebre a cena
        const speedSq = window.vec3.squaredLength(this.vel);
        const maxSpeed = 300.0;
        if (speedSq > maxSpeed * maxSpeed) {
            window.vec3.scale(this.vel, this.vel, maxSpeed / Math.sqrt(speedSq));
        }

        // Aplicação do controle de velocidade do usuário
        const effectiveVel = window.vec3.create();
        window.vec3.scale(effectiveVel, this.vel, this.speedMultiplier);

        // Atualiza posição
        window.vec3.scaleAndAdd(this.pos, this.pos, effectiveVel, dt);

        // Fronteira da Caixa (Quique elástico)
        const limit = boxSize / 2;
        for (let i = 0; i < 3; i++) {
            if (Math.abs(this.pos[i]) > limit) {
                this.pos[i] = Math.sign(this.pos[i]) * limit;
                this.vel[i] *= -0.9; 
            }
        }

        // Zera aceleração para o próximo frame
        window.vec3.set(this.acc, 0, 0, 0);
    }

    checkCollision(other) {
        if (!this.pos || !other.pos) return;
        
        const dx = other.pos[0] - this.pos[0];
        const dy = other.pos[1] - this.pos[1];
        const dz = other.pos[2] - this.pos[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = this.radius + other.radius;

        if (distSq < minDist * minDist) {
            const distance = Math.sqrt(distSq) || 0.001;
            const overlap = minDist - distance;

            const nx = dx / distance;
            const ny = dy / distance;
            const nz = dz / distance;

            // Resolve interpenetração movendo as esferas fisicamente
            const separationX = nx * overlap * 0.5;
            const separationY = ny * overlap * 0.5;
            const separationZ = nz * overlap * 0.5;

            this.pos[0] -= separationX; this.pos[1] -= separationY; this.pos[2] -= separationZ;
            other.pos[0] += separationX; other.pos[1] += separationY; other.pos[2] += separationZ;

            // Conservação de momento
            const rvx = this.vel[0] - other.vel[0];
            const rvy = this.vel[1] - other.vel[1];
            const rvz = this.vel[2] - other.vel[2];

            const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

            if (velAlongNormal > 0) {
                const restitution = 0.8; 
                const impulseScalar = (-(1 + restitution) * velAlongNormal) / ((1 / this.mass) + (1 / other.mass));

                this.vel[0] += (impulseScalar / this.mass) * nx;
                this.vel[1] += (impulseScalar / this.mass) * ny;
                this.vel[2] += (impulseScalar / this.mass) * nz;

                other.vel[0] -= (impulseScalar / other.mass) * nx;
                other.vel[1] -= (impulseScalar / other.mass) * ny;
                other.vel[2] -= (impulseScalar / other.mass) * nz;
            }
        }
    }

    draw(ctx, camera, isSelected) {
        if (!this.pos) return;
        const proj = camera.projectPoint(this.pos);
        if (!proj) return;

        const visualRadius = this.radius * (550 / (550 + proj.depth));
        if (visualRadius < 0.5) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Onda de choque ao cruzar a Octree
        if (this.pulseEffect > 0) {
            ctx.strokeStyle = `rgba(0, 210, 255, ${this.pulseEffect})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, visualRadius + (1.0 - this.pulseEffect) * 30, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Anel de Seleção
        if (isSelected) {
            ctx.strokeStyle = '#ff9f43';
            ctx.lineWidth = 3.0;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, visualRadius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        const grad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, visualRadius * 1.5);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 1.0)`);
        grad.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, visualRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

function computeGravitationalForces(bodies, G = 1.0, softening = 1.0) {
    const n = bodies.length;
    for (let i = 0; i < n; i++) window.vec3.set(bodies[i].acc, 0, 0, 0);

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const b1 = bodies[i];
            const b2 = bodies[j];

            const dx = b2.pos[0] - b1.pos[0];
            const dy = b2.pos[1] - b1.pos[1];
            const dz = b2.pos[2] - b1.pos[2];
            
            const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
            const dist = Math.sqrt(distSq);

            // Lei da Gravitação: F = G * M * m / d^2
            const forceMag = (G * b1.mass * b2.mass) / distSq;
            
            let finalForceF1 = forceMag;
            let finalForceF2 = forceMag;

            if (b1.isRepelling) finalForceF1 = -forceMag * 2.0;
            if (b2.isRepelling) finalForceF2 = -forceMag * 2.0;

            const dirX = dx / dist, dirY = dy / dist, dirZ = dz / dist;
            
            window.vec3.add(b1.acc, b1.acc, [(finalForceF2 * dirX) / b1.mass, (finalForceF2 * dirY) / b1.mass, (finalForceF2 * dirZ) / b1.mass]);
            window.vec3.add(b2.acc, b2.acc, [(-finalForceF1 * dirX) / b2.mass, (-finalForceF1 * dirY) / b2.mass, (-finalForceF1 * dirZ) / b2.mass]);
        }
    }
}

window.CelestialBody = CelestialBody;
window.computeGravitationalForces = computeGravitationalForces;