/**
 * js/physics.js
 * Motor de Dinâmica Orbital, Campos Gravitacionais e Colisões 3D
 */

class Body {
    constructor(x, y, z, mass = 1.0, radius = 6) {
        this.pos = vec3.fromValues(x, y, z);
        this.vel = vec3.fromValues(0, 0, 0); // Começa parado
        this.acc = vec3.fromValues(0, 0, 0);
        this.mass = mass;
        this.radius = radius;
        this.isRepelling = false;
    }

    applyForce(fx, fy, fz) {
        // F = ma => a = F/m
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
            z: this.vel[2]
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
}

class CelestialBody {
    constructor(x, y, z, radius, id) {
        this.id = id;
        this.pos = window.vec3.fromValues(x, y, z);
        this.vel = window.vec3.create(); // Começa com velocidade zero
        this.acc = window.vec3.create(); // Aceleração
        this.force = window.vec3.create();

        this.radius = radius;
        // Massa proporcional ao volume: M = (4/3)*π*r³*ρ
        this.mass = Math.max(0.5, Math.pow(radius / 6, 3) * 10.0);

        this.speedMultiplier = 1.0;
        this.isRepelling = false;
        this.hasMovedOnce = false;
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

    // BUG FIX: Integração rigorosa com aceleração
    integrate(dt, boxSize) {
        if (!this.acc) this.acc = window.vec3.create();
        
        // a = F/m (Segunda Lei de Newton)
        const a = window.vec3.create();
        window.vec3.scale(a, this.acc, 1.0 / this.mass);

        // v = v + a*dt (Euler Semi-implícito)
        window.vec3.scaleAndAdd(this.vel, this.vel, a, dt);

        // Aplicar multiplicador de velocidade se existir
        if (this.speedMultiplier !== 1.0) {
            window.vec3.scale(this.vel, this.vel, this.speedMultiplier);
        }

        // Limitar velocidade máxima para evitar instabilidade
        const maxSpeed = 500.0; // Aumentado de 400
        const speedSq = window.vec3.squaredLength(this.vel);
        if (speedSq > maxSpeed * maxSpeed) {
            const currentSpeed = Math.sqrt(speedSq);
            window.vec3.scale(this.vel, this.vel, maxSpeed / currentSpeed);
        }

        // p = p + v*dt
        window.vec3.scaleAndAdd(this.pos, this.pos, this.vel, dt);

        // Wrapping de posição (opcional - remover se não desejar)
        const limit = boxSize / 2;
        if (Math.abs(this.pos[0]) > limit) this.pos[0] *= -0.95;
        if (Math.abs(this.pos[1]) > limit) this.pos[1] *= -0.95;
        if (Math.abs(this.pos[2]) > limit) this.pos[2] *= -0.95;

        // Resetar aceleração para próximo frame
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
            // Colisão simples: trocar direção
            const temp = window.vec3.create();
            window.vec3.copy(temp, this.vel);
            window.vec3.copy(this.vel, other.vel);
            window.vec3.copy(other.vel, temp);
        }
    }

    draw(ctx, camera, isSelected) {
        if (!this.pos) return;
        
        const proj = camera.projectPoint(this.pos);
        if (!proj) return;

        const visualRadius = this.radius * (550 / (550 + proj.depth));
        
        // Desenhar corpo
        ctx.fillStyle = `rgb(${this.color.r},${this.color.g},${this.color.b})`;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(2, visualRadius), 0, Math.PI * 2);
        ctx.fill();

        // Desenhar borda se selecionado
        if (isSelected) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, Math.max(2, visualRadius) + 5, 0, Math.PI * 2);
            ctx.stroke();
            
            // Desenhar informações
            ctx.fillStyle = '#00ff00';
            ctx.font = '11px monospace';
            ctx.fillText(`ID:${this.id} M:${this.mass.toFixed(1)}`, proj.x + visualRadius + 5, proj.y - 5);
        }

        // Desenhar trilha de velocidade
        if (this.vel && window.vec3.length(this.vel) > 0.1) {
            const nextPos = window.vec3.create();
            window.vec3.scaleAndAdd(nextPos, this.pos, this.vel, 10);
            const nextProj = camera.projectPoint(nextPos);
            
            if (nextProj) {
                ctx.strokeStyle = 'rgba(200,200,255,0.5)';
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
 * Calcula forças gravitacionais com rigor físico
 * F = G * (m1 * m2) / r²
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

            // Vetor de separação
            const dx = b2.pos[0] - b1.pos[0];
            const dy = b2.pos[1] - b1.pos[1];
            const dz = b2.pos[2] - b1.pos[2];
            
            const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
            const dist = Math.sqrt(distSq);

            if (dist < 1e-9) continue; // Evitar singularidade

            // Força gravitacional: F = G * m1 * m2 / r²
            const forceMag = G * b1.mass * b2.mass / (distSq);
            
            // Direção normalizada
            const dirX = dx / dist;
            const dirY = dy / dist;
            const dirZ = dz / dist;

            // Aplicar força em b1 (atração de b2)
            const f1 = [forceMag * dirX / b1.mass, forceMag * dirY / b1.mass, forceMag * dirZ / b1.mass];
            window.vec3.add(b1.acc, b1.acc, f1);

            // Aplicar força em b2 (reação oposta)
            const f2 = [-forceMag * dirX / b2.mass, -forceMag * dirY / b2.mass, -forceMag * dirZ / b2.mass];
            window.vec3.add(b2.acc, b2.acc, f2);

            // Modo repulsão para corpos com flag
            if (b1.isRepelling && !b2.isRepelling) {
                const repulsionForce = [
                    -forceMag * dirX / b1.mass,
                    -forceMag * dirY / b1.mass,
                    -forceMag * dirZ / b1.mass
                ];
                window.vec3.add(b1.acc, b1.acc, repulsionForce);
            }
            if (b2.isRepelling && !b1.isRepelling) {
                const repulsionForce = [
                    forceMag * dirX / b2.mass,
                    forceMag * dirY / b2.mass,
                    forceMag * dirZ / b2.mass
                ];
                window.vec3.add(b2.acc, b2.acc, repulsionForce);
            }
        }
    }
}

/**
 * Integração de todos os corpos
 */
function integrateBodies(bodies, dt, maxSpeed = 500.0, boxSize = 1000) {
    for (let body of bodies) {
        if (body && typeof body.integrate === 'function') {
            body.integrate(dt, boxSize);
        }
    }
}

window.CelestialBody = CelestialBody;
window.computeGravitationalForces = computeGravitationalForces;
window.integrateBodies = integrateBodies;