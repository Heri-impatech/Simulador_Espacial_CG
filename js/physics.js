/**
 * js/physics.js
 * Motor de Dinâmica Orbital Rigoroso e Shading Planetário
 */

class CelestialBody {
    constructor(x, y, z, radius, id) {
        this.id = id;
        this.pos = window.vec3.fromValues(x, y, z);
        this.vel = window.vec3.create();
        this.acc = window.vec3.create();

        // Escala planetária liberada
        this.radius = Math.max(2, radius);
        // Massa tratada como grandeza escalar abstrata
        this.mass = Math.max(0.1, Math.pow(this.radius, 3) * 0.005);

        this.isRepelling = false;
        this.speedMultiplier = 1.0;
        
        // Interação com a Octree
        this.currentOctreeDepth = 0;
        this.lastOctreeDepth = 0;
        this.warpPulse = 0; 

        this.color = this.generateCosmicColor();
    }

    generateCosmicColor() {
        // Cores Planetárias Realistas
        if (this.radius > 60) return { r: 255, g: 100, b: 0 };    // Supergigante
        if (this.radius > 40) return { r: 100, g: 150, b: 255 };  // Gigante Gasosa (Netuno)
        if (this.radius > 20) return { r: 200, g: 180, b: 140 };  // Planeta Árido (Júpiter/Vênus)
        if (this.radius > 10) return { r: 40, g: 120, b: 80 };    // Mundo Terrestre
        
        return {
            r: Math.floor(100 + Math.sin(this.id * 1.5) * 50),
            g: Math.floor(120 + Math.cos(this.id * 1.2) * 60),
            b: Math.floor(140 + Math.sin(this.id * 1.8) * 70)
        };
    }

    integrate(dt, boxSize) {
        if (!this.acc || isNaN(this.acc[0])) return;
        
        const a = window.vec3.create();
        window.vec3.scale(a, this.acc, 1.0 / this.mass);

        // Integração de Velocidade
        window.vec3.scaleAndAdd(this.vel, this.vel, a, dt);

        // ACELERAÇÃO OCTREE: Ganho cinético ao adentrar nós mais profundos da malha
        if (this.currentOctreeDepth > this.lastOctreeDepth) {
            window.vec3.scale(this.vel, this.vel, 1.025); // 2.5% de ganho de velocidade (Efeito Slingshot da Malha)
            this.warpPulse = 1.0;
        }
        this.lastOctreeDepth = this.currentOctreeDepth;
        if (this.warpPulse > 0) this.warpPulse -= dt * 2.0;

        window.vec3.scale(this.vel, this.vel, 0.999); // Amortecimento microscópico

        // Limite de Estabilidade Numérica
        const maxSpeed = 1000.0;
        const speedSq = window.vec3.squaredLength(this.vel);
        if (speedSq > maxSpeed * maxSpeed) {
            window.vec3.scale(this.vel, this.vel, maxSpeed / Math.sqrt(speedSq));
        }

        const effectiveVel = window.vec3.create();
        window.vec3.scale(effectiveVel, this.vel, this.speedMultiplier);

        window.vec3.scaleAndAdd(this.pos, this.pos, effectiveVel, dt);

        const limit = boxSize / 2;
        for(let i=0; i<3; i++) {
            if (Math.abs(this.pos[i]) > limit) {
                this.pos[i] = Math.sign(this.pos[i]) * limit;
                this.vel[i] *= -0.5; // Absorção de impacto nas bordas
            }
        }

        window.vec3.set(this.acc, 0, 0, 0);
    }

    checkCollision(other) {
        const dx = other.pos[0] - this.pos[0];
        const dy = other.pos[1] - this.pos[1];
        const dz = other.pos[2] - this.pos[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = this.radius + other.radius;

        if (distSq < minDist * minDist) {
            const distance = Math.sqrt(distSq) || 0.001;
            const overlap = minDist - distance;
            const nx = dx / distance, ny = dy / distance, nz = dz / distance;

            const sepX = nx * overlap * 0.5, sepY = ny * overlap * 0.5, sepZ = nz * overlap * 0.5;
            this.pos[0] -= sepX; this.pos[1] -= sepY; this.pos[2] -= sepZ;
            other.pos[0] += sepX; other.pos[1] += sepY; other.pos[2] += sepZ;

            const rvx = this.vel[0] - other.vel[0];
            const rvy = this.vel[1] - other.vel[1];
            const rvz = this.vel[2] - other.vel[2];
            const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

            if (velAlongNormal > 0) {
                const restitution = 0.85; 
                const impulse = (-(1 + restitution) * velAlongNormal) / ((1 / this.mass) + (1 / other.mass));

                this.vel[0] += (impulse / this.mass) * nx;
                this.vel[1] += (impulse / this.mass) * ny;
                this.vel[2] += (impulse / this.mass) * nz;

                other.vel[0] -= (impulse / other.mass) * nx;
                other.vel[1] -= (impulse / other.mass) * ny;
                other.vel[2] -= (impulse / other.mass) * nz;
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

        // Pulso Gravitacional da Octree
        if (this.warpPulse > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(0, 255, 200, ${this.warpPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, visualRadius + (1.0 - this.warpPulse) * 50, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }

        if (isSelected) {
            ctx.strokeStyle = this.isRepelling ? '#ff4757' : '#2ed573';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, visualRadius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Shading Planetário (Texturização 3D simulada via Canvas)
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, visualRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
        ctx.fill();

        // Gradiente de Sombra (Terminador)
        const shadow = ctx.createLinearGradient(
            proj.x - visualRadius * 0.7, proj.y - visualRadius * 0.7, 
            proj.x + visualRadius, proj.y + visualRadius
        );
        shadow.addColorStop(0, 'rgba(255, 255, 255, 0.4)'); // Reflexo Especular
        shadow.addColorStop(0.3, 'rgba(0, 0, 0, 0)');        // Meio-tom
        shadow.addColorStop(0.8, 'rgba(0, 0, 0, 0.85)');     // Umbra
        
        ctx.fillStyle = shadow;
        ctx.fill();

        ctx.restore();
    }
}

// CÁLCULO RIGOROSO DA GRAVIDADE (F = G * m1 * m2 / d²)
function computeGravitationalForces(bodies, G = 1.0) {
    const n = bodies.length;
    for (let i = 0; i < n; i++) window.vec3.set(bodies[i].acc, 0, 0, 0);

    const G_REAL = G * 1500.0; // Escala gráfica da constante G

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const b1 = bodies[i];
            const b2 = bodies[j];

            const dx = b2.pos[0] - b1.pos[0];
            const dy = b2.pos[1] - b1.pos[1];
            const dz = b2.pos[2] - b1.pos[2];
            const distSq = dx * dx + dy * dy + dz * dz;
            
            // RIGOR FÍSICO: Softening dinâmico baseado na soma dos raios para evitar singularidade
            const softening = (b1.radius + b2.radius) * 0.5;
            const effectiveDistSq = distSq + (softening * softening);
            const dist = Math.sqrt(effectiveDistSq);

            let forceMag = (G_REAL * b1.mass * b2.mass) / effectiveDistSq;
            if (b1.isRepelling || b2.isRepelling) forceMag *= -1.5;
            
            const ax = (forceMag / b1.mass) * (dx / dist);
            const ay = (forceMag / b1.mass) * (dy / dist);
            const az = (forceMag / b1.mass) * (dz / dist);

            window.vec3.add(b1.acc, b1.acc, [ax, ay, az]);

            const bx = -(forceMag / b2.mass) * (dx / dist);
            const by = -(forceMag / b2.mass) * (dy / dist);
            const bz = -(forceMag / b2.mass) * (dz / dist);
            
            window.vec3.add(b2.acc, b2.acc, [bx, by, bz]);
        }
    }
}

window.CelestialBody = CelestialBody;
window.computeGravitationalForces = computeGravitationalForces;