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
        // Paleta de cores realista para corpos celestes
        const colorPalette = [
            // Gigantes gasosos
            { r: 255, g: 140, b: 0, type: 'gas-giant' },      // Laranja (Júpiter)
            { r: 220, g: 180, b: 100, type: 'gas-giant' },    // Bege (Saturno)
            // Planetas terrestres
            { r: 139, g: 69, b: 19, type: 'terrestrial' },    // Marrom (Marte)
            { r: 70, g: 130, b: 180, type: 'terrestrial' },   // Azul (Terra)
            // Estrelas
            { r: 255, g: 255, b: 200, type: 'star' },         // Amarelo (Anã Amarela)
            { r: 255, g: 150, b: 100, type: 'star' },         // Laranja (Anã Laranja)
            { r: 255, g: 200, b: 220, type: 'star' },         // Rosa (Anã Vermelha)
        ];
        
        // Selecionar cor baseada no raio
        if (this.radius > 18) {
            const choice = Math.floor(this.id % 3);
            return colorPalette[choice]; // Gigantes
        }
        if (this.radius > 12) {
            const choice = 3 + Math.floor(this.id % 1);
            return colorPalette[choice]; // Terrestres
        }
        if (this.radius > 8) {
            const choice = 4 + Math.floor(this.id % 3);
            return colorPalette[choice]; // Estrelas pequenas
        }
        // Pequenos asteroides/cometas com cor aleatória
        return {
            r: 150 + Math.sin(this.id * 0.7) * 105,
            g: 180 + Math.cos(this.id * 0.9) * 75,
            b: 240 + Math.sin(this.id * 1.1) * 15
        };
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
        
        // Criar cor mais brilhante para o gradiente
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

        // ========== SELEÇÃO: BORDA DESTACADA ==========
        if (isSelected) {
            const glowColor = this.isRepelling ? '#ff6b6b' : '#00ff88';
            
            // Múltiplas camadas de glow para efeito holográfico
            for (let i = 3; i >= 1; i--) {
                ctx.strokeStyle = this.isRepelling ? 
                    `rgba(255, 107, 107, ${0.3 / i})` : 
                    `rgba(0, 255, 136, ${0.3 / i})`;
                ctx.lineWidth = 2 * i;
                ctx.beginPath();
                ctx.arc(proj.x, proj.y, effectiveRadius + 4 + (i * 2), 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Borda principal selecionada
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, effectiveRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
            
            // Informações detalhadas
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

        // ========== TRILHA DE VELOCIDADE MELHORADA ==========
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
                
                // Ponta da seta
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