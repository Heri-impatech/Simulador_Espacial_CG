/**
 * js/main.js
 * Orquestrador da Simulação Gravitacional N-Corpos com Octree Barnes-Hut
 * 
 * Este módulo coordena todos os sistemas:
 * - Inicialização e redimensionamento do Canvas (ajustado à área principal)
 * - Gerenciamento do ciclo de vida dos corpos celestes
 * - Delegação de eventos da interface de controle (sidebar)
 * - Loop principal de simulação: física → colisões → integração → renderização
 * - Raycasting para seleção de corpos via clique no Canvas
 * 
 * O loop principal executa a 60 FPS via requestAnimationFrame com passo
 * temporal limitado para estabilidade numérica.
 */

window.addEventListener('load', () => {
    const canvas = document.getElementById('cosmosCanvas');
    const ctx = canvas.getContext('2d');

    // ══════════════════════════════════════════════════
    // REDIMENSIONAMENTO DO CANVAS
    // CRÍTICO: O canvas deve ocupar APENAS a área do main-content,
    // não a janela inteira, pois há uma sidebar fixa à esquerda.
    // ══════════════════════════════════════════════════
    function resizeCanvas() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            canvas.width = mainContent.clientWidth;
            canvas.height = mainContent.clientHeight;
        } else {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Sistemas principais
    const camera = new window.Camera3D(canvas);
    const spatialOctree = new window.Octree(1200, 6);

    // Estado da simulação
    let bodies = [];
    let selectedBody = null;
    let currentG = 1.0;
    let simulationActive = true;
    let frameCount = 0;

    // ══════════════════════════════════════════════════
    // REFERÊNCIAS DE INTERFACE (UI)
    // ══════════════════════════════════════════════════

    // Controles globais
    const slideQty = document.getElementById('slide-qty');
    const slideG = document.getElementById('slide-g');
    const checkOctree = document.getElementById('check-octree');
    const checkSimulation = document.getElementById('check-simulation');

    // Editor de corpo (inspetor)
    const inspectorControls = document.getElementById('inspector-controls');
    const noSelectionMsg = document.getElementById('no-selection-msg');
    const slideBodyMass = document.getElementById('slide-body-mass');
    const slideBodySize = document.getElementById('slide-body-size');
    const slideBodyVx = document.getElementById('slide-body-vx');
    const slideBodyVy = document.getElementById('slide-body-vy');
    const slideBodyVz = document.getElementById('slide-body-vz');

    // Botões de ação
    const btnInvertDir = document.getElementById('btn-invert-dir');
    const btnZeroVelocity = document.getElementById('btn-zero-velocity');
    const btnResetScene = document.getElementById('btn-reset-scene');

    // Spans de exibição de valores
    const valQty = document.getElementById('val-qty');
    const valG = document.getElementById('val-g');
    const valBodyMass = document.getElementById('val-body-mass');
    const valBodySize = document.getElementById('val-body-size');
    const valBodyVx = document.getElementById('val-body-vx');
    const valBodyVy = document.getElementById('val-body-vy');
    const valBodyVz = document.getElementById('val-body-vz');

    // Cards de informação
    const selectedBodyId = document.getElementById('selected-body-id');
    const selectedBodyMode = document.getElementById('selected-body-mode');
    const selectedBodySpeed = document.getElementById('selected-body-speed');
    const selectedBodyPos = document.getElementById('selected-body-pos');
    const statusText = document.getElementById('status-text');

    // ══════════════════════════════════════════════════
    // CAMPO ESTELAR DE FUNDO (Estrelas estáticas decorativas)
    // ══════════════════════════════════════════════════
    const starField = [];
    function generateStarField(count) {
        starField.length = 0;
        for (let i = 0; i < count; i++) {
            starField.push({
                x: Math.random(),
                y: Math.random(),
                size: 0.5 + Math.random() * 1.5,
                brightness: 0.3 + Math.random() * 0.7
            });
        }
    }
    generateStarField(200);

    function drawStarField() {
        for (const star of starField) {
            const sx = star.x * canvas.width;
            const sy = star.y * canvas.height;
            ctx.fillStyle = `rgba(200, 210, 230, ${star.brightness * 0.6})`;
            ctx.beginPath();
            ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ══════════════════════════════════════════════════
    // GERAÇÃO DO AGLOMERADO INICIAL
    // Cria N corpos com posições aleatórias esféricas e
    // velocidades iniciais tangenciais.
    // ══════════════════════════════════════════════════
    function spawnCluster(count) {
        bodies = [];
        const safeCount = Math.max(1, Math.min(count, 50));

        for (let i = 0; i < safeCount; i++) {
            // Posição: distribuição uniforme no cubo [-300, 300]³
            const px = (Math.random() - 0.5) * 600;
            const py = (Math.random() - 0.5) * 600;
            const pz = (Math.random() - 0.5) * 600;

            // Raio entre 5 e 30 unidades (gera boa variação de massa)
            const radius = 5 + Math.random() * 25;
            const body = new window.CelestialBody(px, py, pz, radius, i);

            // Velocidade inicial: distribuição esférica isotrópica
            // usando coordenadas esféricas com θ uniforme e φ com cos⁻¹ uniforme
            const speed = 0.5 + Math.random() * 2.0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            window.vec3.set(body.vel,
                speed * Math.sin(phi) * Math.cos(theta),
                speed * Math.sin(phi) * Math.sin(theta),
                speed * Math.cos(phi)
            );

            bodies.push(body);
        }
        clearSelection();
    }

    // ══════════════════════════════════════════════════
    // GERENCIAMENTO DE SELEÇÃO
    // ══════════════════════════════════════════════════
    function clearSelection() {
        selectedBody = null;
        if (inspectorControls) inspectorControls.classList.add('hidden');
        if (noSelectionMsg) noSelectionMsg.style.display = 'block';
    }

    /**
     * Atualiza a interface do inspetor para refletir as propriedades
     * atuais do corpo selecionado.
     */
    function updateInspectorUI() {
        if (!selectedBody) return;
        if (inspectorControls) inspectorControls.classList.remove('hidden');
        if (noSelectionMsg) noSelectionMsg.style.display = 'none';

        // ── Sincroniza sliders com valores atuais do corpo ──
        if (slideBodyMass) {
            slideBodyMass.value = selectedBody.mass;
            if (valBodyMass) valBodyMass.textContent = selectedBody.mass.toFixed(1);
        }
        if (slideBodySize) {
            slideBodySize.value = selectedBody.radius;
            if (valBodySize) valBodySize.textContent = selectedBody.radius.toFixed(0);
        }
        if (slideBodyVx) {
            slideBodyVx.value = Math.max(-5, Math.min(5, selectedBody.vel[0]));
            if (valBodyVx) valBodyVx.textContent = selectedBody.vel[0].toFixed(2);
        }
        if (slideBodyVy) {
            slideBodyVy.value = Math.max(-5, Math.min(5, selectedBody.vel[1]));
            if (valBodyVy) valBodyVy.textContent = selectedBody.vel[1].toFixed(2);
        }
        if (slideBodyVz) {
            slideBodyVz.value = Math.max(-5, Math.min(5, selectedBody.vel[2]));
            if (valBodyVz) valBodyVz.textContent = selectedBody.vel[2].toFixed(2);
        }

        // ── Atualiza o card de informações ──
        if (selectedBodyId) {
            selectedBodyId.textContent = `CORPO #${selectedBody.id}`;
        }
        if (selectedBodyMode) {
            selectedBodyMode.textContent = 'GRAVIDADE';
            selectedBodyMode.style.color = 'var(--neon-green)';
            selectedBodyMode.style.borderColor = 'rgba(46, 204, 113, 0.3)';
            selectedBodyMode.style.background = 'rgba(46, 204, 113, 0.15)';
        }

        // Velocidade escalar (módulo do vetor)
        const speed = window.vec3.length(selectedBody.vel);
        if (selectedBodySpeed) {
            selectedBodySpeed.textContent = speed.toFixed(2) + ' u/s';
        }
        if (selectedBodyPos) {
            selectedBodyPos.textContent = `X:${selectedBody.pos[0].toFixed(0)} Y:${selectedBody.pos[1].toFixed(0)} Z:${selectedBody.pos[2].toFixed(0)}`;
        }

        // (A repulsão foi removida para rigor físico astrofísico)
    }

    // ══════════════════════════════════════════════════
    // DELEGAÇÃO DE EVENTOS DE INTERFACE
    // ══════════════════════════════════════════════════

    // ── Controles Globais ──
    if (slideQty) {
        slideQty.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (valQty) valQty.textContent = val;
            clearSelection();
            spawnCluster(val);
        });
    }

    if (slideG) {
        slideG.addEventListener('input', (e) => {
            currentG = parseFloat(e.target.value);
            if (valG) valG.textContent = currentG.toFixed(1);
        });
    }

    if (checkSimulation) {
        checkSimulation.addEventListener('change', (e) => {
            simulationActive = e.target.checked;
            if (statusText) {
                statusText.textContent = simulationActive ? 'MOTOR FÍSICO: ONLINE' : 'MOTOR FÍSICO: PAUSADO';
            }
        });
    }

    // ── Editor de Corpo: Slider de TAMANHO ──
    // Altera o raio E recalcula a massa a partir do novo volume esférico
    // (mantém a relação física M = ρ × V = ρ × (4/3)πR³)
    if (slideBodySize) {
        slideBodySize.addEventListener('input', (e) => {
            if (!selectedBody) return;
            const newRadius = parseFloat(e.target.value);
            selectedBody.radius = newRadius;
            // Recalcula massa a partir do volume
            selectedBody.mass = selectedBody.computeMassFromRadius(newRadius);
            // Atualiza cor (depende da massa)
            selectedBody.color = selectedBody.generateCosmicColor();
            updateInspectorUI();
        });
    }

    // ── Editor de Corpo: Slider de MASSA ──
    // Permite ajuste direto da massa (desacopla temporariamente da geometria)
    if (slideBodyMass) {
        slideBodyMass.addEventListener('input', (e) => {
            if (!selectedBody) return;
            selectedBody.mass = parseFloat(e.target.value);
            selectedBody.color = selectedBody.generateCosmicColor();
            if (valBodyMass) valBodyMass.textContent = selectedBody.mass.toFixed(1);
        });
    }

    // ── Editor de Corpo: Sliders de VELOCIDADE (Vx, Vy, Vz) ──
    // Cada slider controla DIRETAMENTE o componente correspondente
    // do vetor velocidade, permitindo ajuste preciso da direção e magnitude
    if (slideBodyVx) {
        slideBodyVx.addEventListener('input', (e) => {
            if (!selectedBody) return;
            selectedBody.vel[0] = parseFloat(e.target.value);
            if (valBodyVx) valBodyVx.textContent = selectedBody.vel[0].toFixed(2);
        });
    }
    if (slideBodyVy) {
        slideBodyVy.addEventListener('input', (e) => {
            if (!selectedBody) return;
            selectedBody.vel[1] = parseFloat(e.target.value);
            if (valBodyVy) valBodyVy.textContent = selectedBody.vel[1].toFixed(2);
        });
    }
    if (slideBodyVz) {
        slideBodyVz.addEventListener('input', (e) => {
            if (!selectedBody) return;
            selectedBody.vel[2] = parseFloat(e.target.value);
            if (valBodyVz) valBodyVz.textContent = selectedBody.vel[2].toFixed(2);
        });
    }

    // ── Previne que os sliders "pulem" se a simulação tentar atualizar o HUD enquanto o usuário edita ──
    window.isEditingSlider = false;
    const bodySliders = [slideBodyMass, slideBodySize, slideBodyVx, slideBodyVy, slideBodyVz];
    bodySliders.forEach(slider => {
        if (!slider) return;
        slider.addEventListener('mousedown', () => window.isEditingSlider = true);
        slider.addEventListener('mouseup', () => window.isEditingSlider = false);
        slider.addEventListener('touchstart', () => window.isEditingSlider = true, {passive: true});
        slider.addEventListener('touchend', () => window.isEditingSlider = false);
    });

    // ── Botões de Ação ──

    // (Ação de Repulsão removida por coerência física)

    // Inverter Direção: nega o vetor velocidade (180°)
    if (btnInvertDir) {
        btnInvertDir.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedBody) return;
            window.vec3.negate(selectedBody.vel, selectedBody.vel);
            updateInspectorUI();
        });
    }

    // Parar: zera a velocidade do corpo selecionado
    if (btnZeroVelocity) {
        btnZeroVelocity.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedBody) return;
            window.vec3.set(selectedBody.vel, 0, 0, 0);
            updateInspectorUI();
        });
    }

    // Reiniciar Cena: regenera todos os corpos
    if (btnResetScene) {
        btnResetScene.addEventListener('click', (e) => {
            e.preventDefault();
            clearSelection();
            spawnCluster(parseInt(slideQty ? slideQty.value : 7));
        });
    }

    // ══════════════════════════════════════════════════
    // RAYCASTING: Seleção de Corpo via Clique no Canvas
    // 
    // Projeta cada corpo para coordenadas de tela e verifica
    // se o clique está dentro da zona de acerto (hitzone),
    // que é proporcional ao raio visual do corpo na projeção
    // perspectiva atual.
    // ══════════════════════════════════════════════════
    let mouseDownPos = {x: 0, y: 0};
    canvas.addEventListener('mousedown', (e) => {
        mouseDownPos = {x: e.clientX, y: e.clientY};
    });
    canvas.addEventListener('mouseup', (e) => {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return; // Ignora se foi arrasto


        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        let closestBody = null;
        let minDist = Infinity;

        for (const body of bodies) {
            const proj = camera.projectPoint(body.pos);
            if (!proj) continue; // Atrás da câmera ou fora do frustum

            const dx = mouseX - proj.x;
            const dy = mouseY - proj.y;
            const dist2D = Math.sqrt(dx * dx + dy * dy);

            // Raio visual com escala perspectiva
            const visualR = Math.max(5, body.radius * (500 / (500 + proj.depth)));

            // Zona de acerto: raio visual + margem para facilitar clique
            const hitZone = visualR * 1.5 + 15;

            if (dist2D <= hitZone && dist2D < minDist) {
                minDist = dist2D;
                closestBody = body;
            }
        }

        selectedBody = closestBody;
        if (selectedBody) {
            updateInspectorUI();
        } else {
            clearSelection();
        }
    });

    // ══════════════════════════════════════════════════
    // LOOP PRINCIPAL DE SIMULAÇÃO (60 FPS)
    // 
    // Pipeline por frame:
    // 1. Limpa o Canvas (fundo escuro + estrelas)
    // 2. Atualiza matrizes da câmera
    // 3. Reconstrói Octree espacial O(N log N)
    // 4. Calcula forças gravitacionais via Barnes-Hut
    // 5. Resolve colisões par-a-par
    // 6. Integra equações de movimento (Euler Simplético)
    // 7. Renderiza Octree wireframe (se ativo)
    // 8. Ordena corpos por profundidade (Z-buffer manual)
    // 9. Renderiza corpos (com rastro orbital)
    // 10. Atualiza HUD do inspetor
    // ══════════════════════════════════════════════════
    let lastTime = null;

    function run(nowMs) {
        if (lastTime === null) lastTime = nowMs;
        const rawDt = (nowMs - lastTime) / 1000;
        // Limite o dt para evitar instabilidade numérica em framerate baixo
        const dt = Math.min(0.033, rawDt);
        lastTime = nowMs;
        frameCount++;

        // ── 1. Limpa Canvas com fundo espacial ──
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Desenha campo estelar decorativo (estrelas de fundo)
        drawStarField();

        // ── 2. Atualiza matrizes de projeção e visualização da câmera ──
        camera.updateMatrices();

        // ── 3-6. Pipeline Físico (apenas quando simulação está ativa) ──
        if (simulationActive) {
            // 3. Reconstrói a Octree com posições atuais dos corpos
            spatialOctree.rebuild(bodies);

            // 4. Calcula forças gravitacionais via Barnes-Hut O(N log N)
            //    Parâmetros: G=currentG, θ=0.5, softening=5.0
            spatialOctree.computeForces(bodies, currentG, 0.5, 5.0);

            // 5. Detecção e resolução de colisões elásticas otimizada O(N log N)
            //    Confina as checagens exclusivamente para corpos que compartilham
            //    a mesma folha espacial na Octree, reduzindo a complexidade.
            spatialOctree.checkCollisions();

            // 6. Integração Simplética de Euler para todos os corpos
            for (const body of bodies) {
                body.integrate(dt, spatialOctree.boundarySize);
            }
        }

        // ── 7. Renderiza wireframe da Octree (se habilitado) ──
        if (checkOctree && checkOctree.checked) {
            // Reconstrói se a simulação estava pausada (garante octree atualizada)
            if (!simulationActive) {
                spatialOctree.rebuild(bodies);
            }
            spatialOctree.draw(ctx, camera);
        }

        // ── 8. Ordena corpos por profundidade (painter's algorithm) ──
        // Objetos mais distantes são desenhados primeiro para que os
        // mais próximos os sobreponham corretamente
        const renderQueue = [];
        for (const body of bodies) {
            const proj = camera.projectPoint(body.pos);
            if (proj) {
                renderQueue.push({ body: body, proj: proj });
            }
        }
        renderQueue.sort((a, b) => b.proj.depth - a.proj.depth);

        // ── 9. Renderiza corpos celestes ──
        for (const item of renderQueue) {
            const isSelected = selectedBody && item.body.id === selectedBody.id;
            item.body.draw(ctx, camera, isSelected);
        }

        // ── 10. Atualiza HUD do inspetor a cada 6 frames (~10 Hz) ──
        if (selectedBody && frameCount % 6 === 0) {
            // Verifica se o corpo selecionado ainda existe
            if (!bodies.includes(selectedBody)) {
                clearSelection();
            } else if (!window.isEditingSlider) {
                updateInspectorUI();
            }
        }

        // Agenda próximo frame
        requestAnimationFrame(run);
    }

    // ══════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ══════════════════════════════════════════════════
    if (slideQty) {
        slideQty.value = 7;
        if (valQty) valQty.textContent = '7';
    }
    spawnCluster(7);
    requestAnimationFrame(run);
});