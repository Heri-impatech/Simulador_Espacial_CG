/**
 * js/octree.js
 * Estrutura de Dados Octree com Algoritmo de Barnes-Hut para Aceleração
 * Gravitacional N-Corpos em O(N log N)
 * 
 * A Octree particiona recursivamente o espaço tridimensional em 8 octantes,
 * permitindo:
 * 1. Organização espacial eficiente dos corpos
 * 2. Consultas de vizinhança rápidas para detecção de colisões
 * 3. Aproximação de Barnes-Hut: grupos distantes de corpos são tratados como
 *    um único corpo virtual posicionado no centro de massa do grupo
 * 
 * O critério de aceitação multipolar (MAC) controla a precisão vs performance:
 *   Se (tamanho_do_nó / distância) < θ, trata o nó como corpo único
 *   θ = 0.5 é o valor clássico que balanceia precisão e velocidade
 * 
 * Complexidade: O(N log N) no caso médio vs O(N²) da força bruta
 */

class OctreeNode {
    /**
     * Cria um nó da Octree representando uma região cúbica do espaço.
     * @param {number} cx - Centro X da região
     * @param {number} cy - Centro Y da região
     * @param {number} cz - Centro Z da região
     * @param {number} size - Tamanho da aresta do cubo
     * @param {number} depth - Profundidade atual na árvore
     * @param {number} maxDepth - Profundidade máxima permitida
     */
    constructor(cx, cy, cz, size, depth, maxDepth) {
        this.cx = cx;
        this.cy = cy;
        this.cz = cz;
        this.size = size;
        this.depth = depth;
        this.maxDepth = maxDepth;

        // Limites AABB (Axis-Aligned Bounding Box) do nó
        const half = size / 2;
        this.xMin = cx - half;
        this.xMax = cx + half;
        this.yMin = cy - half;
        this.yMax = cy + half;
        this.zMin = cz - half;
        this.zMax = cz + half;

        // Corpos contidos neste nó folha
        this.bodies = [];
        // Filhos (8 octantes quando subdividido)
        this.children = [];
        this.isDivided = false;

        // ══════════════════════════════════════════════════
        // Propriedades de Barnes-Hut (Corpo Virtual)
        // O centro de massa e massa total permitem tratar
        // um agrupamento distante como um único corpo pontual
        // ══════════════════════════════════════════════════
        this.centerOfMass = window.vec3.fromValues(cx, cy, cz);
    }

    /**
     * Subdivide este nó em 8 octantes filhos.
     * Redistribui os corpos existentes para os octantes apropriados.
     */
    subdivide() {
        const nextSize = this.size / 2;
        const quarter = this.size / 4;
        const nextDepth = this.depth + 1;

        // Cria 8 octantes filhos (todas combinações de sinais +/- nos 3 eixos)
        const signs = [-1, 1];
        for (const xSign of signs) {
            for (const ySign of signs) {
                for (const zSign of signs) {
                    this.children.push(new OctreeNode(
                        this.cx + xSign * quarter,
                        this.cy + ySign * quarter,
                        this.cz + zSign * quarter,
                        nextSize,
                        nextDepth,
                        this.maxDepth
                    ));
                }
            }
        }
        this.isDivided = true;

        // Redistribui corpos existentes para os filhos
        for (const body of this.bodies) {
            this._insertIntoChildren(body);
        }
        this.bodies = [];
    }

    /**
     * Insere um corpo no octante filho apropriado baseado em sua posição.
     * @param {CelestialBody} body - Corpo a ser inserido
     * @returns {boolean} Sucesso da inserção
     */
    _insertIntoChildren(body) {
        for (const child of this.children) {
            if (body.pos[0] >= child.xMin && body.pos[0] < child.xMax &&
                body.pos[1] >= child.yMin && body.pos[1] < child.yMax &&
                body.pos[2] >= child.zMin && body.pos[2] < child.zMax) {
                return child.insert(body);
            }
        }
        // Corpo está na borda — insere no último filho como fallback
        if (this.children.length > 0) {
            return this.children[0].insert(body);
        }
        return false;
    }

    /**
     * Insere um corpo neste nó. Se o nó já contiver mais de 1 corpo
     * e a profundidade máxima não foi atingida, subdivide.
     * @param {CelestialBody} body - Corpo a ser inserido
     * @returns {boolean} Sucesso da inserção
     */
    insert(body) {
        if (this.isDivided) {
            return this._insertIntoChildren(body);
        }

        this.bodies.push(body);

        // Subdivide quando o nó excede a capacidade populacional (N > 4) conforme fundamentação
        if (this.bodies.length > 4 && this.depth < this.maxDepth) {
            this.subdivide();
        }
        return true;
    }

    /**
     * BARNES-HUT - Passo 1: Distribução de Massa
     * 
     * Calcula recursivamente o centro de massa ponderado e a massa total
     * de cada nó da árvore, de baixo para cima (post-order traversal).
     * 
     * Para um nó com N corpos:
     *   M_total = Σ mᵢ
     *   r_cm = (Σ mᵢ × rᵢ) / M_total
     */
    computeMassDistribution() {
        if (this.isDivided) {
            // Nó interno: agrega propriedades dos filhos
            let totalMass = 0;
            const weightedPos = window.vec3.create();

            for (const child of this.children) {
                child.computeMassDistribution();
                if (child.totalMass > 0) {
                    totalMass += child.totalMass;
                    // Soma ponderada: Σ mᵢ × rᵢ
                    window.vec3.scaleAndAdd(weightedPos, weightedPos, child.centerOfMass, child.totalMass);
                }
            }

            this.totalMass = totalMass;
            if (totalMass > 0) {
                // Centro de massa = (Σ mᵢ × rᵢ) / M_total
                window.vec3.scale(this.centerOfMass, weightedPos, 1.0 / totalMass);
            }
            return;
        }

        // Nó folha: calcula a partir dos corpos diretamente
        let totalMass = 0;
        const weightedPos = window.vec3.create();

        for (const body of this.bodies) {
            totalMass += body.mass;
            window.vec3.scaleAndAdd(weightedPos, weightedPos, body.pos, body.mass);
        }

        this.totalMass = totalMass;
        if (totalMass > 0) {
            window.vec3.scale(this.centerOfMass, weightedPos, 1.0 / totalMass);
        }
    }

    /**
     * BARNES-HUT - Passo 2: Acumulação de Forças Gravitacionais
     * 
     * Para cada corpo, percorre a árvore e decide se pode usar a
     * aproximação multipolar (nó distante → corpo virtual) ou deve
     * descer para cálculos diretos (nó próximo).
     * 
     * Lei de Newton: F = G × m₁ × m₂ / r²
     * Como armazenamos ACELERAÇÃO: a = G × m_other / r² × r̂
     * (massa do corpo receptor já foi dividida)
     * 
     * @param {CelestialBody} body - Corpo que recebe as forças
     * @param {number} G - Constante gravitacional (multiplicador)
     * @param {number} theta - Critério MAC (0.5 = padrão Barnes-Hut)
     * @param {number} softening - Parâmetro de suavização (evita singularidades)
     */
    accumulateForce(body, G, theta, softening) {
        if (!this.isDivided && this.bodies.length === 0) return;

        // Fator de escala gravitacional para que a interação seja visualmente
        // apreciável na escala de pixels do Canvas (calibrado experimentalmente)
        const G_SCALED = G * 2000.0;

        if (!this.isDivided) {
            // ── Nó Folha: Cálculo Direto de Força (par a par) ──
            for (const other of this.bodies) {
                if (other === body) continue;

                const dx = other.pos[0] - body.pos[0];
                const dy = other.pos[1] - body.pos[1];
                const dz = other.pos[2] - body.pos[2];

                // Distância com parâmetro de suavização (softening) para evitar
                // singularidades quando r → 0: r_eff² = r² + ε²
                const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
                const dist = Math.sqrt(distSq);

                if (dist < 0.001) continue; // Proteção numérica

                // ══════════════════════════════════════════════════
                // Lei da Gravitação Universal de Newton:
                // F = G × m₁ × m₂ / r²
                // 
                // Aceleração sobre o corpo (F/m₁ = G × m₂ / r²):
                // a = G × m_other / r² × r̂
                // 
                // onde r̂ = (dx, dy, dz) / |r| é o vetor unitário
                // ══════════════════════════════════════════════════
                let accMag = (G_SCALED * other.mass) / distSq;

                // Projeta a aceleração nos 3 eixos via vetor unitário
                const ax = accMag * (dx / dist);
                const ay = accMag * (dy / dist);
                const az = accMag * (dz / dist);

                body.addAcceleration(ax, ay, az);
            }
            return;
        }

        // ── Nó Interno: Critério de Aceitação Multipolar (MAC) ──
        // Calcula se o nó está "distante o suficiente" para ser aproximado
        const dx = this.centerOfMass[0] - body.pos[0];
        const dy = this.centerOfMass[1] - body.pos[1];
        const dz = this.centerOfMass[2] - body.pos[2];
        const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
        const dist = Math.sqrt(distSq);

        // MAC: s/d < θ  →  nó suficientemente distante para aproximação
        if (dist > 0.001 && (this.size / dist) < theta) {
            // Trata todo o octante como um único corpo virtual no centro de massa
            let accMag = (G_SCALED * this.totalMass) / distSq;

            const ax = accMag * (dx / dist);
            const ay = accMag * (dy / dist);
            const az = accMag * (dz / dist);

            body.addAcceleration(ax, ay, az);
        } else {
            // Nó muito próximo → desce na árvore para maior precisão
            for (const child of this.children) {
                child.accumulateForce(body, G, theta, softening);
            }
        }
    }

    /**
     * Executa checagem de colisões confinada à folha espacial.
     * Corpos apenas interagem fisicamente se estiverem no mesmo octante folha.
     */
    checkCollisions() {
        if (this.isDivided) {
            for (const child of this.children) {
                child.checkCollisions();
            }
        } else {
            for (let i = 0; i < this.bodies.length; i++) {
                for (let j = i + 1; j < this.bodies.length; j++) {
                    this.bodies[i].checkCollision(this.bodies[j]);
                }
            }
        }
    }

    /**
     * Renderiza o wireframe (contorno) deste nó da Octree.
     * Apenas nós folha contendo corpos são desenhados para evitar poluição visual.
     * 
     * Projeta os 8 vértices do cubo para coordenadas de tela e desenha
     * as 12 arestas usando projeção perspectiva da câmera.
     * 
     * @param {CanvasRenderingContext2D} ctx - Contexto 2D do Canvas
     * @param {Camera3D} camera - Sistema de câmera 3D
     */
    drawWireframe(ctx, camera) {
        if (this.isDivided) {
            // Nó interno: delega renderização para os filhos
            for (const child of this.children) {
                child.drawWireframe(ctx, camera);
            }
            return;
        }

        // Pula nós vazios (sem corpos)
        if (this.bodies.length === 0) return;

        const h = this.size / 2;

        // 8 vértices do cubo (AAB)
        const vertices = [
            [this.cx - h, this.cy - h, this.cz - h], // 0: frente-inferior-esquerdo
            [this.cx + h, this.cy - h, this.cz - h], // 1: frente-inferior-direito
            [this.cx + h, this.cy + h, this.cz - h], // 2: frente-superior-direito
            [this.cx - h, this.cy + h, this.cz - h], // 3: frente-superior-esquerdo
            [this.cx - h, this.cy - h, this.cz + h], // 4: trás-inferior-esquerdo
            [this.cx + h, this.cy - h, this.cz + h], // 5: trás-inferior-direito
            [this.cx + h, this.cy + h, this.cz + h], // 6: trás-superior-direito
            [this.cx - h, this.cy + h, this.cz + h]  // 7: trás-superior-esquerdo
        ];

        // Projeta cada vértice para coordenadas de tela
        const projected = vertices.map(v => camera.projectPoint(v));

        // 12 arestas do cubo (pares de índices dos vértices)
        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],  // Face frontal
            [4, 5], [5, 6], [6, 7], [7, 4],  // Face traseira
            [0, 4], [1, 5], [2, 6], [3, 7]   // Arestas conectoras
        ];

        // Refinamento Visual: Cores mais vibrantes, espessura maior e variação
        // de matiz (hue) para evidenciar a estrutura da malha Octree.
        // A cor varia de ciano (nós maiores/rasos) para magenta/roxo (nós menores/profundos)
        const hue = 190 + (this.depth * 20); 
        const alpha = Math.min(0.9, 0.3 + (this.depth * 0.1));
        ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
        
        // Linhas mais grossas na raiz, afinando levemente nas folhas
        ctx.lineWidth = Math.max(1.0, 2.5 - this.depth * 0.25);

        // Desenha apenas arestas onde AMBOS os vértices foram projetados com sucesso
        for (const [i, j] of edges) {
            const pi = projected[i];
            const pj = projected[j];
            if (pi && pj) {
                ctx.beginPath();
                ctx.moveTo(pi.x, pi.y);
                ctx.lineTo(pj.x, pj.y);
                ctx.stroke();
            }
        }
    }
}

/**
 * Classe principal da Octree que gerencia a estrutura espacial.
 * Provê interface de alto nível para reconstrução, cálculo de forças
 * e renderização da malha.
 */
class Octree {
    /**
     * @param {number} boundarySize - Tamanho total do domínio de simulação (aresta do cubo)
     * @param {number} maxDepth - Profundidade máxima da árvore (controla granularidade)
     */
    constructor(boundarySize = 1200, maxDepth = 6) {
        this.boundarySize = boundarySize;
        this.maxDepth = maxDepth;
        this.root = null;
    }

    /**
     * Reconstrói a Octree do zero inserindo todos os corpos.
     * Necessário a cada frame porque os corpos se movem.
     * 
     * Após inserção, calcula a distribuição de massa para Barnes-Hut.
     * @param {CelestialBody[]} bodiesList - Lista de corpos na simulação
     */
    rebuild(bodiesList) {
        this.root = new OctreeNode(0, 0, 0, this.boundarySize, 0, this.maxDepth);
        for (const body of bodiesList) {
            if (body && body.pos) {
                this.root.insert(body);
            }
        }
        this.root.computeMassDistribution();
    }

    /**
     * Calcula as forças gravitacionais sobre todos os corpos usando Barnes-Hut.
     * 
     * 1. Zera as acelerações de todos os corpos
     * 2. Para cada corpo, percorre a árvore acumulando acelerações
     * 
     * @param {CelestialBody[]} bodiesList - Lista de corpos
     * @param {number} G - Multiplicador da constante gravitacional
     * @param {number} theta - Parâmetro de abertura MAC (0.5 recomendado)
     * @param {number} softening - Parâmetro de suavização (evita r→0)
     */
    computeForces(bodiesList, G = 1.0, theta = 0.5, softening = 5.0) {
        // Zera acelerações antes de acumular novas forças
        for (const body of bodiesList) {
            body.resetAcceleration();
        }
        // Acumula forças gravitacionais via Barnes-Hut
        for (const body of bodiesList) {
            this.root.accumulateForce(body, G, theta, softening);
        }
    }

    /**
     * Resolve colisões restritas aos octantes espaciais em O(N log N).
     */
    checkCollisions() {
        if (this.root) {
            this.root.checkCollisions();
        }
    }

    /**
     * Renderiza a malha wireframe da Octree no Canvas.
     * @param {CanvasRenderingContext2D} ctx - Contexto 2D
     * @param {Camera3D} camera - Sistema de câmera 3D
     */
    draw(ctx, camera) {
        if (this.root) {
            this.root.drawWireframe(ctx, camera);
        }
    }
}

window.Octree = Octree;