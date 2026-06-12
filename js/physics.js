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
        this.repulsionStrength = 1.0; // Multiplicador de força de repulsão
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
        // Massa proporcional ao volume: M = (4/3)*π*r³*ρ
        this.mass = Math.max(0.5, Math.pow(radius / 6, 3) * 10.0);

        this.isRepelling = false;
        this.repulsionStrength = 1.0;
        this.color = this.generateCosmicColor();
    }

    generateCosmicColor() {
        if (this.radius > 18) {
            return { r: 255, g: 200, b: 100 }; // Laranja/dourado para grandes
        }
        if (this.radius > 10) {
            return { r: 100, g: 150, b: 255 }; // Azul para médios
        }
        return { r: 240, g: 240, b: 255 }; // Branco para pequenos
    }

    // Integração rigorosa (método de Euler semi-implícito)
    integrate(dt, boxSize) {
        if (!this.acc) this.acc = window.vec3.create();
        
        // a = F/m (Segunda Lei de Newton)
        const a = window.vec3.create();
        window.vec3.scale(a, this.acc, 1.0 / this.mass);

        // v = v + a*dt
        window.vec3.scaleAndAdd(this.vel, this.vel, a, dt);

        // Amortecimento leve
        window.vec3.scale(this.vel, this.vel, 0.999);

        // Limitar velocidade máxima
        const maxSpeed = 500.0;
        const speedSq = window.vec3.squaredLength(this.vel);
        if (speedSq > maxSpeed * maxSpeed) {
            const currentSpeed = Math.sqrt(speedSq);
            window.vec3.scale(this.vel, this.vel, maxSpeed / currentSpeed);
        }

        // p = p + v*dt
        window.vec3.scaleAndAdd(this.pos, this.pos, this.vel, dt);

        // Wrapping de posição
        const limit = boxSize / 2;
        if (Math.abs(this.pos[0]) > limit) {
            this.pos[0] *= -0.98;
            this.vel[0] *= -0.8;
        }
        if (Math.abs(this.pos[1]) > limit) {
            this.pos[1] *= -0.98;
            this.vel[1] *= -0.8;
        }
        if (Math.abs(this.pos[2]) > limit) {
            this.pos[2] *= -0.98;
            this.vel[2] *= -0.8;
        }

        // Resetar aceleração
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
            // Colisão: trocar velocidades
            const temp = window.vec3.create();
            window.vec3.copy(temp, this.vel);
            window.vec3.copy(this.vel, other.vel);
            window.vec3.copy(other.vel, temp);
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
        
        // Desenhar corpo
        const baseColor = `rgb(${this.color.r},${this.color.g},${this.color.b})`;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(2, visualRadius), 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = baseColor;
        ctx.strokeStyle = `rgba(${this.color.r},${this.color.g},${this.color.b},0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(2, visualRadius) + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Desenhar borda e informações se selecionado
        if (isSelected) {
            const glowColor = this.isRepelling ? '#ff6b6b' : '#00ff88';
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, Math.max(2, visualRadius) + 6, 0, Math.PI * 2);
            ctx.stroke();
            
            // Informações detalhadas
            const speed = this.getSpeed();
            ctx.fillStyle = glowColor;
            ctx.font = '12px monospace';
            ctx.fillText(`ID:${this.id} M:${this.mass.toFixed(1)} V:${speed.toFixed(2)}`, proj.x + visualRadius + 10, proj.y - 15);
            ctx.fillText(`R:${this.radius.toFixed(1)} ${this.isRepelling ? '(REPULSÃO)' : '(ATRAÇÃO)'}`, proj.x + visualRadius + 10, proj.y);
        }

        // Desenhar trilha de velocidade
        if (this.vel && window.vec3.length(this.vel) > 0.1) {
            const nextPos = window.vec3.create();
            window.vec3.scaleAndAdd(nextPos, this.pos, this.vel, 10);
            const nextProj = camera.projectPoint(nextPos);
            
            if (nextProj) {
                const trailColor = this.isRepelling ? 'rgba(255,100,100,0.4)' : 'rgba(100,200,255,0.4)';
                ctx.strokeStyle = trailColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(proj.x, proj.y);
                ctx.lineTo(nextProj.x, nextProj.y);
                ctx.stroke();
            }
        }
    }
}

/**
 * Calcula forças gravitacionais com rigor físico (Lei da Gravitação Universal)
 * F = G * (m1 * m2) / r²
 * 
 * Modo de Interação:
 * - Default: ATRAÇÃO (como corpos celestes reais)
 * - Com flag isRepelling: REPULSÃO (influenciada por massa e velocidade)
 */
function computeGravitationalForces(bodies, G = 1.0, softening = 0.5) {
    const n = bodies.length;
    
    // Resetar acelerações
    for (let i = 0; i < n; i++) {
        if (!bodies[i].acc) bodies[i].acc = window.vec3.create();
        window.vec3.set(bodies[i].acc, 0, 0, 0);
    }

    // Calcular forças entre todos os pares
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const b1 = bodies[i];
            const b2 = bodies[j];

            if (!b1.pos || !b2.pos) continue;

            // Vetor de separação: r = r2 - r1
            const dx = b2.pos[0] - b1.pos[0];
            const dy = b2.pos[1] - b1.pos[1];
            const dz = b2.pos[2] - b1.pos[2];
            
            const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
            const dist = Math.sqrt(distSq);

            if (dist < 1e-6) continue; // Evitar singularidade

            // Lei da Gravitação Universal: F = G * m1 * m2 / r²
            const forceMag = (G * b1.mass * b2.mass) / distSq;
            
            // Direção normalizada do vetor separação
            const dirX = dx / dist;
            const dirY = dy / dist;
            const dirZ = dz / dist;

            // ========== MODO PADRÃO: ATRAÇÃO ==========
            // Aplicar força atrativa em b1 (direção: b1 → b2)
            const f1x = forceMag * dirX / b1.mass;
            const f1y = forceMag * dirY / b1.mass;
            const f1z = forceMag * dirZ / b1.mass;
            window.vec3.add(b1.acc, b1.acc, [f1x, f1y, f1z]);

            // Aplicar força atrativa em b2 (direção: b2 → b1, reação oposta)
            const f2x = -forceMag * dirX / b2.mass;
            const f2y = -forceMag * dirY / b2.mass;
            const f2z = -forceMag * dirZ / b2.mass;
            window.vec3.add(b2.acc, b2.acc, [f2x, f2y, f2z]);

            // ========== MODO REPULSÃO ==========
            // Se um corpo está em modo repulsão, inverte a força
            if (b1.isRepelling) {
                const repStr = b1.repulsionStrength || 1.0;
                const speedFactor = 1.0 + (b1.getSpeed ? b1.getSpeed() * 0.05 : 0);
                const massBoost = b1.mass / Math.max(0.5, b2.mass);
                const repulsionMult = repStr * speedFactor * massBoost;
                
                // Força repulsiva em b1 (afasta de b2)
                const repF1x = -f1x * repulsionMult;
                const repF1y = -f1y * repulsionMult;
                const repF1z = -f1z * repulsionMult;
                window.vec3.add(b1.acc, b1.acc, [repF1x, repF1y, repF1z]);
            }

            if (b2.isRepelling) {
                const repStr = b2.repulsionStrength || 1.0;
                const speedFactor = 1.0 + (b2.getSpeed ? b2.getSpeed() * 0.05 : 0);
                const massBoost = b2.mass / Math.max(0.5, b1.mass);
                const repulsionMult = repStr * speedFactor * massBoost;
                
                // Força repulsiva em b2 (afasta de b1)
                const repF2x = -f2x * repulsionMult;
                const repF2y = -f2y * repulsionMult;
                const repF2z = -f2z * repulsionMult;
                window.vec3.add(b2.acc, b2.acc, [repF2x, repF2y, repF2z]);
            }
        }
    }
}

/**
 * Integração de todos os corpos usando método de Euler semi-implícito
 * v_new = v + a * dt
 * p_new = p + v_new * dt
 */
function integrateBodies(bodies, dt, maxSpeed = 500.0, boxSize = 1000) {
    const damping = 0.999; // Pequeno amortecimento para estabilidade

    for (let body of bodies) {
        if (!body || !body.pos || !body.vel || !body.acc) continue;

        // Atualizar velocidade: v = v + a * dt
        window.vec3.scaleAndAdd(body.vel, body.vel, body.acc, dt);

        // Aplicar amortecimento leve (reduz oscilações)
        window.vec3.scale(body.vel, body.vel, damping);

        // Limitar velocidade máxima para evitar instabilidade
        const speedSq = window.vec3.squaredLength(body.vel);
        if (speedSq > maxSpeed * maxSpeed) {
            const currentSpeed = Math.sqrt(speedSq);
            window.vec3.scale(body.vel, body.vel, maxSpeed / currentSpeed);
        }

        // Atualizar posição: p = p + v * dt
        window.vec3.scaleAndAdd(body.pos, body.pos, body.vel, dt);

        // Wrapping de posição (bounce nas bordas)
        const limit = boxSize / 2;
        if (Math.abs(body.pos[0]) > limit) {
            body.pos[0] *= -0.98;
            body.vel[0] *= -0.8; // Amortecimento no bounce
        }
        if (Math.abs(body.pos[1]) > limit) {
            body.pos[1] *= -0.98;
            body.vel[1] *= -0.8;
        }
        if (Math.abs(body.pos[2]) > limit) {
            body.pos[2] *= -0.98;
            body.vel[2] *= -0.8;
        }

        // Resetar aceleração para próximo frame
        window.vec3.set(body.acc, 0, 0, 0);
    }
}

window.CelestialBody = CelestialBody;
window.computeGravitationalForces = computeGravitationalForces;
window.integrateBodies = integrateBodies;