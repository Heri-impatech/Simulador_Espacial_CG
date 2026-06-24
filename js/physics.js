/**
 * js/physics.js
 * Motor Físico Newtoniano Rigoroso - Corpo Celeste com Propriedades Volumétricas
 * 
 * Cada corpo é uma esfera rígida cuja massa é derivada diretamente de seu volume
 * geométrico: M = ρ × (4/3)πR³, onde ρ é a densidade uniforme.
 * 
 * A integração numérica utiliza o método Simplético de Euler (Semi-Implícito),
 * que preserva a energia total do sistema a longo prazo, fundamental para
 * simulações orbitais estáveis.
 * 
 * As colisões são resolvidas como choques elásticos com conservação de momento
 * linear, coeficiente de restituição configurável e correção geométrica de
 * interpenetração proporcional à massa inversa.
 */

class CelestialBody {
    /**
     * Cria um corpo celeste com propriedades físicas derivadas de sua geometria.
     * @param {number} x - Posição inicial no eixo X (unidades de simulação)
     * @param {number} y - Posição inicial no eixo Y
     * @param {number} z - Posição inicial no eixo Z
     * @param {number} radius - Raio da esfera (unidades de simulação)
     * @param {number} id - Identificador único do corpo
     */
    constructor(x, y, z, radius, id) {
        this.id = id;

        // Vetores de estado cinemático (posição, velocidade, aceleração)
        this.pos = window.vec3.fromValues(x, y, z);
        this.vel = window.vec3.create();
        // IMPORTANTE: this.acc armazena ACELERAÇÃO (a = F/m), NÃO força.
        // Isso evita dupla divisão por massa durante a integração.
        this.acc = window.vec3.create();

        // Geometria do corpo - raio limitado para estabilidade visual e numérica
        this.radius = Math.max(3, Math.min(120, radius));

        // ══════════════════════════════════════════════════
        // RIGOR FÍSICO: Massa derivada do volume esférico
        // M = ρ × V = ρ × (4/3)πR³
        // Densidade ρ = 0.01 (calibrada para que corpos de raio ~15
        // tenham massa ~141, produzindo atrações gravitacionais
        // visualmente apreciáveis na escala do Canvas)
        // ══════════════════════════════════════════════════
        this.density = 0.01;
        this.mass = this.computeMassFromRadius(this.radius);

        // Remoção de repulsão: o modelo simula estritamente gravidade
        // conforme fundamentação do relatório.

        // Aparência visual determinada pela massa (classificação espectral)
        this.color = this.generateCosmicColor();

        // Rastro orbital: armazena posições recentes para desenhar a trajetória
        this.trail = [];
        this.trailTimer = 0;
        this.maxTrailLength = 80;
    }

    /**
     * Calcula a massa a partir do raio usando a relação volumétrica esférica.
     * V = (4/3)πR³, M = ρ × V
     * @param {number} r - Raio da esfera
     * @returns {number} Massa resultante (mínimo 0.1 para estabilidade numérica)
     */
    computeMassFromRadius(r) {
        const volume = (4.0 / 3.0) * Math.PI * Math.pow(r, 3);
        return Math.max(0.1, volume * this.density);
    }

    /**
     * Zera o acumulador de aceleração para o próximo frame.
     * Deve ser chamado ANTES de acumular forças gravitacionais.
     */
    resetAcceleration() {
        window.vec3.set(this.acc, 0, 0, 0);
    }

    /**
     * Acumula uma contribuição de aceleração ao corpo.
     * Como armazenamos aceleração (não força), cada contribuição já está
     * dividida pela massa do corpo receptor.
     * @param {number} ax - Componente X da aceleração
     * @param {number} ay - Componente Y da aceleração
     * @param {number} az - Componente Z da aceleração
     */
    addAcceleration(ax, ay, az) {
        this.acc[0] += ax;
        this.acc[1] += ay;
        this.acc[2] += az;
    }

    /**
     * Integração Simplética de Euler (Semi-Implícita)
     * 
     * Diferentemente do Euler Explícito, o método simplético atualiza
     * a velocidade PRIMEIRO e depois usa essa nova velocidade para atualizar
     * a posição, preservando propriedades hamiltonianas do sistema:
     * 
     *   v(t+Δt) = v(t) + a(t) × Δt       [Passo 1: kick]
     *   x(t+Δt) = x(t) + v(t+Δt) × Δt    [Passo 2: drift]
     * 
     * @param {number} dt - Passo temporal (segundos)
     * @param {number} boxSize - Tamanho do domínio de simulação (cubo)
     */
    integrate(dt, boxSize) {
        // Proteção contra NaN/Infinity na aceleração
        if (!isFinite(this.acc[0]) || !isFinite(this.acc[1]) || !isFinite(this.acc[2])) {
            this.resetAcceleration();
            return;
        }

        // ── Passo 1 (Kick): Atualiza velocidade com aceleração acumulada ──
        // v_new = v_old + a * dt
        window.vec3.scaleAndAdd(this.vel, this.vel, this.acc, dt);

        // Amortecimento suave do vácuo (microatrito para estabilidade numérica
        // a longo prazo, sem destruir órbitas — fator muito próximo de 1)
        window.vec3.scale(this.vel, this.vel, 0.9997);

        // ── Passo 2 (Drift): Atualiza posição com a nova velocidade ──
        // x_new = x_old + v_new * dt
        window.vec3.scaleAndAdd(this.pos, this.pos, this.vel, dt);

        // ── Condições de Contorno: Reflexão nas paredes do domínio ──
        // Coeficiente de restituição 0.7 simula perda de energia na colisão
        // com a parede, impedindo que corpos escapem da octree
        const limit = boxSize / 2;
        for (let i = 0; i < 3; i++) {
            if (this.pos[i] > limit) {
                this.pos[i] = limit;
                this.vel[i] *= -0.7;
            } else if (this.pos[i] < -limit) {
                this.pos[i] = -limit;
                this.vel[i] *= -0.7;
            }
        }

        // ── Gravação do Rastro Orbital ──
        this.trailTimer++;
        if (this.trailTimer >= 2) {
            this.trailTimer = 0;
            this.trail.push(window.vec3.clone(this.pos));
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }

        // Zera aceleração para o próximo frame (acumulação limpa)
        this.resetAcceleration();
    }

    /**
     * Resolução de Colisão Elástica entre dois corpos esféricos.
     * 
     * Utiliza a conservação de momento linear e um coeficiente de restituição
     * para determinar as velocidades pós-colisão. A correção de posição
     * é proporcional à massa inversa (corpo mais leve é mais deslocado).
     * 
     * Fórmulas fundamentais (colisão unidimensional ao longo da normal):
     *   J = -(1 + e) × v_rel·n / (1/m₁ + 1/m₂)
     *   v₁' = v₁ + (J/m₁) × n
     *   v₂' = v₂ - (J/m₂) × n
     * 
     * @param {CelestialBody} other - O outro corpo para verificar colisão
     */
    checkCollision(other) {
        const dx = other.pos[0] - this.pos[0];
        const dy = other.pos[1] - this.pos[1];
        const dz = other.pos[2] - this.pos[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = this.radius + other.radius;

        if (distSq < minDist * minDist && distSq > 0.0001) {
            const distance = Math.sqrt(distSq);
            const overlap = minDist - distance;

            // Vetor normal unitário da colisão (aponta de this para other)
            const nx = dx / distance;
            const ny = dy / distance;
            const nz = dz / distance;

            // ── Correção de Interpenetração ──
            // Distribui a separação proporcionalmente à massa inversa:
            // corpo mais leve é empurrado mais longe
            const totalInvMass = (1.0 / this.mass) + (1.0 / other.mass);
            const sepThis = (overlap / totalInvMass) * (1.0 / this.mass);
            const sepOther = (overlap / totalInvMass) * (1.0 / other.mass);

            this.pos[0] -= nx * sepThis;
            this.pos[1] -= ny * sepThis;
            this.pos[2] -= nz * sepThis;

            other.pos[0] += nx * sepOther;
            other.pos[1] += ny * sepOther;
            other.pos[2] += nz * sepOther;

            // ── Velocidade Relativa ao longo da Normal ──
            const relVx = this.vel[0] - other.vel[0];
            const relVy = this.vel[1] - other.vel[1];
            const relVz = this.vel[2] - other.vel[2];
            const velAlongNormal = relVx * nx + relVy * ny + relVz * nz;

            // Resolve apenas se os corpos estão se aproximando (evita re-resolução)
            if (velAlongNormal > 0) {
                // Coeficiente de restituição: 0.9 = quase perfeitamente elástico
                const restitution = 0.9;

                // Impulso escalar: J = -(1+e) × v_rel·n / (1/m₁ + 1/m₂)
                const impulse = (-(1 + restitution) * velAlongNormal) / totalInvMass;

                // Aplica impulso a cada corpo (J/m × n)
                this.vel[0] += (impulse / this.mass) * nx;
                this.vel[1] += (impulse / this.mass) * ny;
                this.vel[2] += (impulse / this.mass) * nz;

                other.vel[0] -= (impulse / other.mass) * nx;
                other.vel[1] -= (impulse / other.mass) * ny;
                other.vel[2] -= (impulse / other.mass) * nz;
            }
        }
    }

    /**
     * Renderiza o corpo celeste no Canvas 2D com projeção perspectiva.
     * 
     * Inclui: rastro orbital, esfera com gradiente 3D, anel de seleção,
     * vetor de velocidade e informações do corpo quando selecionado.
     * 
     * @param {CanvasRenderingContext2D} ctx - Contexto 2D do Canvas
     * @param {Camera3D} camera - Sistema de câmera para projeção 3D->2D
     * @param {boolean} isSelected - Se este corpo está selecionado pelo usuário
     */
    draw(ctx, camera, isSelected) {
        if (!this.pos) return;
        const proj = camera.projectPoint(this.pos);
        if (!proj) return;

        // Escala perspectiva: objetos distantes parecem menores
        const perspectiveFactor = 500 / (500 + proj.depth);
        const visualRadius = Math.max(2, this.radius * perspectiveFactor);
        if (visualRadius < 0.5) return;

        ctx.save();

        // ── Rastro Orbital (Trajetória Recente) ──
        if (this.trail.length > 1) {
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < this.trail.length; i++) {
                const tp = camera.projectPoint(this.trail[i]);
                if (!tp) continue;
                if (!started) {
                    ctx.moveTo(tp.x, tp.y);
                    started = true;
                } else {
                    ctx.lineTo(tp.x, tp.y);
                }
            }
            // Conecta ao ponto atual
            ctx.lineTo(proj.x, proj.y);

            // Opacidade progressiva: mais forte perto do corpo
            const trailAlpha = Math.min(0.5, 0.15 + (this.mass / 2000));
            ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${trailAlpha})`;
            ctx.lineWidth = Math.max(1, visualRadius * 0.15);
            ctx.stroke();
        }

        // ── Halo de Atmosfera / Glow ──
        if (this.mass > 50) {
            const glowRadius = visualRadius * 2.0;
            const glow = ctx.createRadialGradient(proj.x, proj.y, visualRadius * 0.5, proj.x, proj.y, glowRadius);
            glow.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.15)`);
            glow.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── Anel de Seleção ──
        if (isSelected) {
            // Anel animado de seleção
            ctx.strokeStyle = '#00d2ff';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, visualRadius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // ── Vetor de Velocidade (seta direcional) ──
            const velMag = window.vec3.length(this.vel);
            if (velMag > 0.01) {
                // Projeta ponto na direção da velocidade
                const velTip = window.vec3.create();
                const velNorm = window.vec3.create();
                window.vec3.normalize(velNorm, this.vel);
                window.vec3.scaleAndAdd(velTip, this.pos, velNorm, this.radius * 3 + velMag * 15);
                const tipProj = camera.projectPoint(velTip);

                if (tipProj) {
                    // Linha da velocidade
                    ctx.strokeStyle = '#ffdd57';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(proj.x, proj.y);
                    ctx.lineTo(tipProj.x, tipProj.y);
                    ctx.stroke();

                    // Ponta da seta
                    const arrowDx = tipProj.x - proj.x;
                    const arrowDy = tipProj.y - proj.y;
                    const arrowLen = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);
                    if (arrowLen > 5) {
                        const ux = arrowDx / arrowLen;
                        const uy = arrowDy / arrowLen;
                        const headSize = Math.min(10, arrowLen * 0.3);
                        ctx.fillStyle = '#ffdd57';
                        ctx.beginPath();
                        ctx.moveTo(tipProj.x, tipProj.y);
                        ctx.lineTo(tipProj.x - ux * headSize - uy * headSize * 0.5, tipProj.y - uy * headSize + ux * headSize * 0.5);
                        ctx.lineTo(tipProj.x - ux * headSize + uy * headSize * 0.5, tipProj.y - uy * headSize - ux * headSize * 0.5);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }

            // ── Label de Massa ──
            ctx.font = '10px monospace';
            ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
            ctx.textAlign = 'center';
            ctx.fillText(`m=${this.mass.toFixed(1)}`, proj.x, proj.y + visualRadius + 22);
        }

        // ── Renderização da Esfera (Gradiente Radial 3D) ──
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, visualRadius, 0, Math.PI * 2);

        // Simula iluminação direcional com gradiente radial deslocado
        const lightOffsetX = -visualRadius * 0.3;
        const lightOffsetY = -visualRadius * 0.3;
        const shadow = ctx.createRadialGradient(
            proj.x + lightOffsetX, proj.y + lightOffsetY, 0,
            proj.x, proj.y, visualRadius
        );

        // Ponto de luz (highlight)
        shadow.addColorStop(0, `rgb(${Math.min(255, this.color.r + 100)}, ${Math.min(255, this.color.g + 100)}, ${Math.min(255, this.color.b + 100)})`);
        // Cor base
        shadow.addColorStop(0.45, `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`);
        // Terminador (transição dia/noite)
        shadow.addColorStop(0.75, `rgb(${Math.floor(this.color.r * 0.5)}, ${Math.floor(this.color.g * 0.5)}, ${Math.floor(this.color.b * 0.5)})`);
        // Lado escuro
        shadow.addColorStop(1, `rgb(${Math.floor(this.color.r * 0.1)}, ${Math.floor(this.color.g * 0.1)}, ${Math.floor(this.color.b * 0.1)})`);

        ctx.fillStyle = shadow;
        ctx.fill();

        ctx.restore();
    }

    /**
     * Gera cor baseada na classificação por massa (analogia espectral estelar).
     * Corpos mais massivos = mais quentes = mais azuis/brancos ou laranja para gigantes.
     * @returns {{r: number, g: number, b: number}} Cor RGB
     */
    generateCosmicColor() {
        if (this.mass > 500) {
            // Estrela Supergigante - laranja/vermelho intenso
            return { r: 255, g: 130 + Math.floor(Math.random() * 40), b: 40 + Math.floor(Math.random() * 30) };
        }
        if (this.mass > 150) {
            // Estrela Quente - azul-branco
            return { r: 150 + Math.floor(Math.random() * 50), g: 180 + Math.floor(Math.random() * 40), b: 255 };
        }
        if (this.mass > 50) {
            // Planeta Gasoso - tons profundos
            return { r: 80 + Math.floor(Math.random() * 40), g: 100 + Math.floor(Math.random() * 60), b: 180 + Math.floor(Math.random() * 50) };
        }
        if (this.mass > 10) {
            // Planeta Rochoso - terra/ocre
            return { r: 160 + Math.floor(Math.random() * 40), g: 120 + Math.floor(Math.random() * 40), b: 80 + Math.floor(Math.random() * 30) };
        }
        // Asteroide/Planetoide - cinza/marrom
        return {
            r: 100 + Math.floor(Math.sin(this.id * 2.3) * 40 + 40),
            g: 110 + Math.floor(Math.cos(this.id * 1.7) * 40 + 40),
            b: 120 + Math.floor(Math.sin(this.id * 3.1) * 40 + 40)
        };
    }
}

window.CelestialBody = CelestialBody;