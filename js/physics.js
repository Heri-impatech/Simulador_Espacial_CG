/**
 * js/physics.js
 * Motor de Dinâmica Orbital com Lei da Gravitação Universal de Newton
 * F = G * (m1 * m2) / r²
 */

class Body {
    constructor(x, y, z, mass = 1.0, radius = 6) {
        this.pos = vec3.fromValues(x, y, z);
        this.vel = vec3.fromValues(0, 0, 0);
        this.acc = vec3.fromValues(0, 0, 0);
        this.mass = Math.max(0.5, mass);
        this.radius = Math.max(2, radius);
        this.isRepelling = false;
        this.repulsionStrength = 1.0; 
    }

    applyForce(fx, fy, fz) {
        // F = ma => a = F/m (Segunda Lei de Newton)
        const ax = fx / this.mass;
        const ay = fy / this.mass;
        const az = fz / this.mass;
        vec3.add(this.acc, this.acc, [ax, ay, az]);
    }

    update(deltaTime) {
        // Atualizar velocidade
        vec3.scaleAndAdd(this.vel, this.vel, this.acc, deltaTime);
        // Atualizar posição
        vec3.scaleAndAdd(this.pos, this.pos, this.vel, deltaTime);
        // Resetar aceleração
        vec3.set(this.acc, 0, 0, 0);
    }

    setVelocity(vx, vy, vz) {
        vec3.set(this.vel, vx, vy, vz);
    }

    getVelocity() {
        return {
            x: this.vel[0],
            y: this.vel[1],
            z: this.vel[2],
            magnitude: vec3.length(this.vel)
        };
    }

    setMass(mass) {
        this.mass = Math.max(0.5, mass);
    }

    setRadius(radius) {
        this.radius = Math.max(2, radius);
    }

    invertVelocity() {
        vec3.negate(this.vel, this.vel);
    }

    getSpeed() {
        return vec3.length(this.vel);
    }
}

class CelestialBody {
    constructor(x, y, z, radius, id) {
        this.id = id;
        this.pos = window.vec3.fromValues(x, y, z);
        this.vel = window.vec3.create();
        this.acc = window.vec3.create();
        this.force = window.vec3.create();

        this.radius = Math.max(2, radius);
        // Massa proporcional ao volume tridimensional real: M = R³ * 0.01
        this.mass = Math.max(0.5, Math.pow(radius, 3) * 0.01);

        this.isRepelling = false;
        this.repulsionStrength = 1.0;
        this.color = this.generateCosmicColor();
    }

    generateCosmicColor() {
        const colorPalette = [
            { r: 255, g: 140, b: 0, type: 'gas-giant' },      
            { r: 220, g: 180, b: 100, type: 'gas-giant' },    
            { r: 139, g: 69, b: 19, type: 'terrestrial' },    
            { r: 70, g: 130, b: 180, type: 'terrestrial' },   
            { r: 255, g: 255, b: 200, type: 'star' },         
            { r: 255, g: 150, b: 100, type: 'star' },         
            { r: 255, g: 200, b: 220, type: 'star' },         
        ];
        
        if (this.radius > 18) {
            const choice = Math.floor(this.id % 3);
            return colorPalette[choice]; 
        }
        if (this.radius > 12) {
            const choice = 3 + Math.floor(this.id % 1);
            return colorPalette[choice]; 
        }
        if (this.radius > 8) {
            const choice = 4 + Math.floor(this.id % 3);
            return colorPalette[choice]; 
        }
        return {
            r: Math.floor(150 + Math.sin(this.id * 0.7) * 105),
            g: Math.floor(180 + Math.cos(this.id * 0.9) * 75),
            b: Math.floor(240 + Math.sin(this.id * 1.1) * 15)
        };
    }

    integrate(dt, boxSize) {
        if (!this.acc) this.acc = window.vec3.create();
        
        const a = window.vec3.create();
        window.vec3.scale(a, this.acc, 1.0 / this.mass);

        // v = v + a*dt
        window.vec3.scaleAndAdd(this.vel, this.vel, a, dt);

        // Amortecimento espacial leve
        window.vec3.scale(this.vel, this.vel, 0.999);

        // Limitar velocidade máxima para estabilidade numérica
        const maxSpeed = 500.0;
        const speedSq = window.vec3.squaredLength(this.vel);
        if (speedSq > maxSpeed * maxSpeed) {
            const currentSpeed = Math.sqrt(speedSq);
            window.vec3.scale(this.vel, this.vel, maxSpeed / currentSpeed);
        }

        // p = p + v*dt
        window.vec3.scaleAndAdd(this.pos, this.pos, this.vel, dt);

        // Wrapping de posição controlado por quique elástico nas bordas da caixa
        const limit = boxSize / 2;
        if (Math.abs(this.pos[0]) > limit) {
            this.pos[0] = Math.sign(this.pos[0]) * limit;
            this.vel[0] *= -0.8;
        }
        if (Math.abs(this.pos[1]) > limit) {
            this.pos[1] = Math.sign(this.pos[1]) * limit;
            this.vel[1] *= -0.8;
        }
        if (Math.abs(this.pos[2]) > limit) {
            this.pos[2] = Math.sign(this.pos[2]) * limit;
            this.vel[2] *= -0.8;
        }

        window.vec3.set(this.acc, 0, 0, 0);
    }

    // =========================================================================
    // CORREÇÃO DO ERRO LÓGICO: COLISÃO COM CONSERVAÇÃO DE MOMENTO REAL (IMPULSO)
    // =========================================================================
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

            // Vetor normal de impacto
            const nx = dx / distance;
            const ny = dy / distance;
            const nz = dz / distance;

            // 1. Correção Posicional Geométrica: remove interpenetração
            const separationX = nx * overlap * 0.5;
            const separationY = ny * overlap * 0.5;
            const separationZ = nz * overlap * 0.5;

            this.pos[0] -= separationX; this.pos[1] -= separationY; this.pos[2] -= separationZ;
            other.pos[0] += separationX; other.pos[1] += separationY; other.pos[2] += separationZ;

            // 2. Modelo de Impulso Físico com base na massa real de cada planeta
            const rvx = this.vel[0] - other.vel[0];
            const rvy = this.vel[1] - other.vel[1];
            const rvz = this.vel[2] - other.vel[2];

            const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

            // Só resolve o choque se os corpos estiverem indo um em direção ao outro
            if (velAlongNormal > 0) {
                const restitution = 0.8; // Coeficiente elástico de restituição
                const impulseScalar = (-(1 + restitution) * velAlongNormal) / ((1 / this.mass) + (1 / other.mass));

                // Modifica os componentes do vetor de velocidade linear final (J / m)
                this.vel[0] += (impulseScalar / this.mass) * nx;
                this.vel[1] += (impulseScalar / this.mass) * ny;
                this.vel[2] += (impulseScalar / this.mass) * nz;

                other.vel[0] -= (impulseScalar / other.mass) * nx;
                other.vel[1] -= (impulseScalar / other.mass) * ny;
                other.vel[2] -= (impulseScalar / other.mass) * nz;
            }
        }
    }

    getSpeed() {
        return window.vec3.length(this.vel);
    }

    draw(ctx, camera, isSelected) {
        if (!this.pos) return;
        
        const proj = camera.projectPoint(this.pos);
        if (!proj) return;

        const visualRadius = this.radius * (550 / (550 + proj.depth));
        const effectiveRadius = Math.max(2, visualRadius);
        
        // ========== EFEITO 1: HALO CÓSMICO EXTERNO ==========
        const haloRadius = effectiveRadius + 8;
        const haloGradient = ctx.createRadialGradient(proj.x, proj.y, effectiveRadius, proj.x, proj.y, haloRadius);
        const haloColor = `rgba(${this.color.r},${this.color.g},${this.color.b}`;
        haloGradient.addColorStop(0, `${haloColor},0.15)`);
        haloGradient.addColorStop(0.5, `${haloColor},0.05)`);
        haloGradient.addColorStop(1, `${haloColor},0)`);
        ctx.fillStyle = haloGradient;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // ========== EFEITO 2: CORPO COM GRADIENTE RADIAL ==========
        const bodyGradient = ctx.createRadialGradient(
            proj.x - effectiveRadius * 0.3, 
            proj.y - effectiveRadius * 0.3, 
            0, 
            proj.x, 
            proj.y, 
            effectiveRadius
        );
        
        const brighterR = Math.min(255, this.color.r + 40);
        const brighterG = Math.min(255, this.color.g + 40);
        const brighterB = Math.min(255, this.color.b + 40);
        
        bodyGradient.addColorStop(0, `rgb(${brighterR},${brighterG},${brighterB})`);
        bodyGradient.addColorStop(0.6, `rgb(${this.color.r},${this.color.g},${this.color.b})`);
        bodyGradient.addColorStop(1, `rgb(${Math.max(0, this.color.r - 50)},${Math.max(0, this.color.g - 50)},${Math.max(0, this.color.b - 50)})`);
        
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, effectiveRadius, 0, Math.PI * 2);
        ctx.fill();

        // ========== EFEITO 3: BRILHO INTERNO (GLOSS) ==========
        const glossGradient = ctx.createRadialGradient(
            proj.x - effectiveRadius * 0.4, 
            proj.y - effectiveRadius * 0.4, 
            0, 
            proj.x, 
            proj.y, 
            effectiveRadius * 0.4
        );
        glossGradient.addColorStop(0, `rgba(255,255,255,0.4)`);
        glossGradient.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = glossGradient;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, effectiveRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // ========== EFEITO 4: BORDA LUMINOSA ==========
        ctx.strokeStyle = `rgba(${this.color.r},${this.color.g},${this.color.b},0.5)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, effectiveRadius, 0, Math.PI * 2);
        ctx.stroke();

        // ========== SELEÇÃO: BORDA DESTACADA COM ANEL HOLOGRÁFICO ==========
        if (isSelected) {
            const glowColor = this.isRepelling ? '#ff6b6b' : '#00ff88';
            
            for (let i = 3; i >= 1; i--) {
                ctx.strokeStyle = this.isRepelling ? 
                    `rgba(255, 107, 107, ${0.3 / i})` : 
                    `rgba(0, 255, 136, ${0.3 / i})`;
                ctx.lineWidth = 2 * i;
                ctx.beginPath();
                ctx.arc(proj.x, proj.y, effectiveRadius + 4 + (i * 2), 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, effectiveRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
            
            const speed = this.getSpeed();
            const posX = proj.x + effectiveRadius + 15;
            const posY = proj.y;
            
            ctx.fillStyle = glowColor;
            ctx.font = 'bold 13px monospace';
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 8;
            
            ctx.fillText(`● CORPO #${this.id}`, posX, posY - 20);
            
            ctx.font = '11px monospace';
            ctx.fillText(`Massa: ${this.mass.toFixed(2)} kg`, posX, posY - 5);
            ctx.fillText(`Raio: ${this.radius.toFixed(1)} px`, posX, posY + 8);
            ctx.fillText(`Vel: ${speed.toFixed(2)} u/s`, posX, posY + 21);
            ctx.fillText(`Modo: ${this.isRepelling ? '💥 REPULSÃO' : '🌍 ATRAÇÃO'}`, posX, posY + 34);
            
            ctx.shadowBlur = 0;
        }

        // ========== TRILHA DE VETOR DE VELOCIDADE (VETOR DIRETOR) ==========
        if (this.vel && window.vec3.length(this.vel) > 0.1) {
            const nextPos = window.vec3.create();
            window.vec3.scaleAndAdd(nextPos, this.pos, this.vel, 10);
            const nextProj = camera.projectPoint(nextPos);
            
            if (nextProj) {
                const speed = this.getSpeed();
                const opacity = Math.min(0.8, speed * 0.1);
                const trailColor = this.isRepelling ? 
                    `rgba(255,100,100,${opacity})` : 
                    `rgba(100,200,255,${opacity})`;
                
                ctx.strokeStyle = trailColor;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(proj.x, proj.y);
                ctx.lineTo(nextProj.x, nextProj.y);
                ctx.stroke();
                
                const angle = Math.atan2(nextProj.y - proj.y, nextProj.x - proj.x);
                const arrowSize = 4;
                ctx.fillStyle = trailColor;
                ctx.beginPath();
                ctx.moveTo(nextProj.x, nextProj.y);
                ctx.lineTo(nextProj.x - arrowSize * Math.cos(angle - Math.PI / 6), nextProj.y - arrowSize * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(nextProj.x - arrowSize * Math.cos(angle + Math.PI / 6), nextProj.y - arrowSize * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
            }
        }
    }
}

// =========================================================================
// CORREÇÃO DO ERRO LÓGICO: GRAVITAÇÃO EXCLUSIVA (OU ATRAI OU REPELE)
// =========================================================================
function computeGravitationalForces(bodies, G = 1.0, softening = 0.5) {
    const n = bodies.length;
    
    for (let i = 0; i < n; i++) {
        if (!bodies[i].acc) bodies[i].acc = window.vec3.create();
        window.vec3.set(bodies[i].acc, 0, 0, 0);
    }

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const b1 = bodies[i];
            const b2 = bodies[j];

            if (!b1.pos || !b2.pos) continue;

            const dx = b2.pos[0] - b1.pos[0];
            const dy = b2.pos[1] - b1.pos[1];
            const dz = b2.pos[2] - b1.pos[2];
            
            const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
            const dist = Math.sqrt(distSq);

            if (dist < 1e-4) continue; 

            let forceMag = (G * b1.mass * b2.mass) / distSq;
            
            const dirX = dx / dist;
            const dirY = dy / dist;
            const dirZ = dz / dist;

            // Se QUALQUER um dos corpos for repulsivo, a magnitude inverte e vira força de empurrão
            let finalForceF1 = forceMag;
            let finalForceF2 = forceMag;

            if (b1.isRepelling) {
                const repStr = b1.repulsionStrength || 1.0;
                const speedFactor = 1.0 + (b1.getSpeed ? b1.getSpeed() * 0.05 : 0);
                const massBoost = b1.mass / Math.max(0.5, b2.mass);
                finalForceF1 = -forceMag * repStr * speedFactor * massBoost;
            }

            if (b2.isRepelling) {
                const repStr = b2.repulsionStrength || 1.0;
                const speedFactor = 1.0 + (b2.getSpeed ? b2.getSpeed() * 0.05 : 0);
                const massBoost = b2.mass / Math.max(0.5, b1.mass);
                finalForceF2 = -forceMag * repStr * speedFactor * massBoost;
            }

            // Componentes de aceleração linear isolados (a = F / m)
            const f1x = finalForceF2 * dirX;
            const f1y = finalForceF2 * dirY;
            const f1z = finalForceF2 * dz / dist;
            window.vec3.add(b1.acc, b1.acc, [f1x, f1y, f1z]);

            const f2x = -finalForceF1 * dirX;
            const f2y = -finalForceF1 * dirY;
            const f2z = -finalForceF1 * dirZ;
            window.vec3.add(b2.acc, b2.acc, [f2x, f2y, f2z]);
        }
    }
}

function integrateBodies(bodies, dt, maxSpeed = 500.0, boxSize = 1000) {
    const damping = 0.999; 

    for (let body of bodies) {
        if (!body || !body.pos || !body.vel || !body.acc) continue;

        window.vec3.scaleAndAdd(body.vel, body.vel, body.acc, dt);
        window.vec3.scale(body.vel, body.vel, damping);

        const speedSq = window.vec3.squaredLength(body.vel);
        if (speedSq > maxSpeed * maxSpeed) {
            const currentSpeed = Math.sqrt(speedSq);
            window.vec3.scale(body.vel, body.vel, maxSpeed / currentSpeed);
        }

        window.vec3.scaleAndAdd(body.pos, body.pos, body.vel, dt);

        const limit = boxSize / 2;
        if (Math.abs(body.pos[0]) > limit) {
            body.pos[0] = Math.sign(body.pos[0]) * limit;
            body.vel[0] *= -0.8; 
        }
        if (Math.abs(body.pos[1]) > limit) {
            body.pos[1] = Math.sign(body.pos[1]) * limit;
            body.vel[1] *= -0.8;
        }
        if (Math.abs(body.pos[2]) > limit) {
            body.pos[2] = Math.sign(body.pos[2]) * limit;
            body.vel[2] *= -0.8;
        }

        window.vec3.set(body.acc, 0, 0, 0);
    }
}

window.CelestialBody = CelestialBody;
window.computeGravitationalForces = computeGravitationalForces;
window.integrateBodies = integrateBodies;