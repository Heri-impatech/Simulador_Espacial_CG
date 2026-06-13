/**
 * js/main.js
 * Orquestrador do Loop de Animação, Gestão de Eventos HUD e Inicialização Global
 */

window.addEventListener('load', () => {
    const canvas = document.getElementById('cosmosCanvas');
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!canvas || !ctx) {
        console.error('canvas ou contexto 2D não encontrado');
        return;
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const camera = new window.Camera3D(canvas);
    const spatialOctree = new window.Octree(400, 5);

    let bodies = [];
    let selectedBody = null;
    let nextBodyId = 0;
    let simulationActive = false; // Inicia desativada
    let currentG = 1.0;

    // Elementos HUD
    const slideQty = document.getElementById('slide-qty');
    const valQty = document.getElementById('val-qty');
    const slideG = document.getElementById('slide-g');
    const valG = document.getElementById('val-g');
    const checkOctree = document.getElementById('check-octree');
    const checkSimulation = document.getElementById('check-simulation');

    const inspectorControls = document.getElementById('inspector-controls');
    const noSelectionMsg = document.getElementById('no-selection-msg');
    
    const selectedBodyId = document.getElementById('selected-body-id');
    const selectedBodyMode = document.getElementById('selected-body-mode');
    const selectedBodySpeed = document.getElementById('selected-body-speed');
    const selectedBodyPos = document.getElementById('selected-body-pos');
    
    const slideBodyMass = document.getElementById('slide-body-mass');
    const valBodyMass = document.getElementById('val-body-mass');
    const slideBodySize = document.getElementById('slide-body-size');
    const valBodySize = document.getElementById('val-body-size');
    
    const slideBodyVx = document.getElementById('slide-body-vx');
    const valBodyVx = document.getElementById('val-body-vx');
    const slideBodyVy = document.getElementById('slide-body-vy');
    const valBodyVy = document.getElementById('val-body-vy');
    const slideBodyVz = document.getElementById('slide-body-vz');
    const valBodyVz = document.getElementById('val-body-vz');
    
    const btnInvertDir = document.getElementById('btn-invert-dir');
    const btnRepulsion = document.getElementById('btn-repulsion');
    const btnZeroVelocity = document.getElementById('btn-zero-velocity');
    const btnResetScene = document.getElementById('btn-reset-scene');

    // ========== DEBUG: Verificar elementos encontrados ==========
    console.log('🔧 VERIFICAÇÃO DE ELEMENTOS:');
    console.log(`  Canvas: ${canvas ? '✓' : '✗'}`);
    console.log(`  Inspector Controls: ${inspectorControls ? '✓' : '✗'}`);
    console.log(`  Slider Massa: ${slideBodyMass ? '✓' : '✗'}`);
    console.log(`  Slider Tamanho: ${slideBodySize ? '✓' : '✗'}`);
    console.log(`  Slider Vx: ${slideBodyVx ? '✓' : '✗'}`);
    console.log(`  Slider Vy: ${slideBodyVy ? '✓' : '✗'}`);
    console.log(`  Slider Vz: ${slideBodyVz ? '✓' : '✗'}`);
    console.log(`  Botão Inverter: ${btnInvertDir ? '✓' : '✗'}`);
    console.log(`  Botão Repulsão: ${btnRepulsion ? '✓' : '✗'}`);
    console.log(`  Botão Zero Vel: ${btnZeroVelocity ? '✓' : '✗'}`);
    console.log('');

    // Corpos em posições ALEATÓRIAS, com velocidade inicial de interação
    function createRandomBody(x = null, y = null, z = null, mass = null, radius = null) {
        const limit = 160; // Espaço seguro para criação dentro da Bounding Box da Octree
        const px = (x !== null) ? x : (Math.random() - 0.5) * limit * 2;
        const py = (y !== null) ? y : (Math.random() - 0.5) * limit * 2;
        const pz = (z !== null) ? z : (Math.random() - 0.5) * limit * 2;
        
        const r = (radius !== null) ? radius : (5 + Math.random() * 15);
        const m = (mass !== null) ? mass : Math.pow(r / 6, 3) * 10.0;
        
        const body = new window.CelestialBody(px, py, pz, r, nextBodyId++);
        body.mass = Math.max(0.5, m);
        
        if (!body.vel) body.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
        if (!body.acc) body.acc = window.vec3 ? window.vec3.create() : [0, 0, 0];
        
        // Velocidade inicial aleatória balanceada para interações orbitais
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5; 
        
        const vx = speed * Math.cos(angle1) * Math.cos(angle2);
        const vy = speed * Math.sin(angle1) * Math.cos(angle2);
        const vz = speed * Math.sin(angle2);
        
        window.vec3.set(body.vel, vx, vy, vz);
        window.vec3.set(body.acc, 0, 0, 0);
        
        body.isRepelling = false;
        
        return body;
    }

    function syncPopulation() {
        const raw = slideQty ? parseInt(slideQty.value || '10', 10) : 10;
        const targetQty = Math.max(1, Math.min(20, Number.isFinite(raw) ? raw : 10));
        
        if (valQty) valQty.textContent = targetQty;

        if (bodies.length !== targetQty) {
            bodies = [];
            nextBodyId = 0;
            
            for (let i = 0; i < targetQty; i++) {
                const body = createRandomBody();
                bodies.push(body);
            }
            
            clearSelection();
            
            const hasVelocity = bodies.some(b => b.vel && window.vec3.length(b.vel) > 0.05);
            if (hasVelocity) {
                simulationActive = true;
                if (checkSimulation) checkSimulation.checked = true;
            }
            
            console.log(`✓ ${targetQty} corpos criados em posições aleatórias com velocidade inicial!`);
        }
    }

    function clearSelection() {
        selectedBody = null;
        if (inspectorControls) {
            inspectorControls.classList.add('hidden');
        }
        if (noSelectionMsg) {
            noSelectionMsg.classList.remove('hidden');
        }
        if (btnRepulsion) {
            btnRepulsion.classList.remove('active');
        }
        console.log('✗ Seleção limpada');
    }

    // ========== SINCRO DE TEXTO E VALORES DO INSPECTOR ==========
    function updateInspectorUI() {
        if (!selectedBody) {
            clearSelection();
            return;
        }

        if (!inspectorControls || !noSelectionMsg) {
            console.error('Elementos do inspector não encontrados');
            return;
        }

        inspectorControls.classList.remove('hidden');
        noSelectionMsg.classList.add('hidden');

        if (!selectedBody.vel) selectedBody.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
        if (!selectedBody.acc) selectedBody.acc = window.vec3 ? window.vec3.create() : [0, 0, 0];

        if (selectedBodyId) {
            selectedBodyId.textContent = `CORPO #${selectedBody.id}`;
        }
        
        if (selectedBodyMode) {
            selectedBodyMode.textContent = selectedBody.isRepelling ? '💥 REPULSÃO' : '🌍 ATRAÇÃO';
        }
        
        const speed = selectedBody.getSpeed ? selectedBody.getSpeed() : window.vec3.length(selectedBody.vel);
        if (selectedBodySpeed) {
            selectedBodySpeed.textContent = `${Math.max(0, speed).toFixed(2)} u/s`;
        }
        
        if (selectedBodyPos && selectedBody.pos) {
            const px = selectedBody.pos[0].toFixed(0);
            const py = selectedBody.pos[1].toFixed(0);
            const pz = selectedBody.pos[2].toFixed(0);
            selectedBodyPos.textContent = `X:${px} Y:${py} Z:${pz}`;
        }

        // Sincronia de Massa
        const mass = Math.max(0.5, selectedBody.mass || 1.0);
        if (slideBodyMass) slideBodyMass.value = mass;
        if (valBodyMass) valBodyMass.textContent = mass.toFixed(2);

        // Sincronia de Raio/Tamanho
        const radius = Math.max(2, selectedBody.radius || 6);
        if (slideBodySize) slideBodySize.value = radius;
        if (valBodySize) valBodySize.textContent = radius.toFixed(1);

        // Sincronia dos Três Sliders de Velocidade Cartesianos
        const vx = parseFloat(selectedBody.vel[0]) || 0;
        const vy = parseFloat(selectedBody.vel[1]) || 0;
        const vz = parseFloat(selectedBody.vel[2]) || 0;

        if (slideBodyVx) slideBodyVx.value = vx;
        if (valBodyVx) valBodyVx.textContent = vx.toFixed(2);

        if (slideBodyVy) slideBodyVy.value = vy;
        if (valBodyVy) valBodyVy.textContent = vy.toFixed(2);

        if (slideBodyVz) slideBodyVz.value = vz;
        if (valBodyVz) valBodyVz.textContent = vz.toFixed(2);

        if (btnRepulsion) {
            if (selectedBody.isRepelling) {
                btnRepulsion.classList.add('active');
            } else {
                btnRepulsion.classList.remove('active');
            }
        }
    }

    // ========== LISTENERS DOS EVENTOS GLOBAIS DE CONFIGURAÇÃO ==========
    if (slideQty) {
        slideQty.addEventListener('input', syncPopulation);
    }

    if (slideG) {
        slideG.addEventListener('input', (e) => {
            currentG = parseFloat(e.target.value) || 1.0;
            if (valG) valG.textContent = currentG.toFixed(1);
        });
    }

    if (checkSimulation) {
        checkSimulation.addEventListener('change', (e) => {
            simulationActive = e.target.checked;
        });
    }

    // ========== MODIFICAÇÃO DE PROPRIEDADES VIA SLIDERS COM ATUALIZAÇÃO RIGOROSA ==========
    if (slideBodyMass) {
        const updateMass = (e) => {
            if (!selectedBody) return;
            const newMass = Math.max(0.5, parseFloat(e.target.value) || 1.0);
            selectedBody.mass = newMass;
            if (valBodyMass) valBodyMass.textContent = newMass.toFixed(2);
        };
        slideBodyMass.addEventListener('input', updateMass, false);
    }

    if (slideBodySize) {
        const updateSize = (e) => {
            if (!selectedBody) return;
            const newRadius = Math.max(2, parseFloat(e.target.value) || 6);
            selectedBody.radius = newRadius;
            if (valBodySize) valBodySize.textContent = newRadius.toFixed(1);
            
            // Recalcula a assinatura cromática do corpo e a massa associada se houver a função volumétrica
            if (selectedBody.generateCosmicColor) {
                selectedBody.color = selectedBody.generateCosmicColor();
            }
        };
        slideBodySize.addEventListener('input', updateSize, false);
    }

    function setupVelocityControl(slideElement, valElement, velocityIndex, axisName) {
        if (!slideElement || !valElement) return;
        
        slideElement.setAttribute('min', '-5');
        slideElement.setAttribute('max', '5');
        slideElement.setAttribute('step', '0.1');
        
        const updateVelocity = (e) => {
            if (!selectedBody) return;
            
            if (!selectedBody.vel) {
                selectedBody.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
            }
            
            const newValue = parseFloat(e.target.value) || 0;
            selectedBody.vel[velocityIndex] = newValue;
            valElement.textContent = newValue.toFixed(2);
            
            const speed = window.vec3.length(selectedBody.vel);
            if (selectedBodySpeed) selectedBodySpeed.textContent = `${speed.toFixed(2)} u/s`;
            
            if (speed > 0.05 && !simulationActive) {
                simulationActive = true;
                if (checkSimulation) checkSimulation.checked = true;
            }
        };
        
        slideElement.addEventListener('input', updateVelocity, false);
    }

    setupVelocityControl(slideBodyVx, valBodyVx, 0, 'X');
    setupVelocityControl(slideBodyVy, valBodyVy, 1, 'Y');
    setupVelocityControl(slideBodyVz, valBodyVz, 2, 'Z');

    // ========== GERENCIAMENTO DE BOTÕES DE INTERAÇÃO DO HUD ==========
    if (btnResetScene) {
        btnResetScene.addEventListener('click', (e) => {
            e.preventDefault();
            bodies = [];
            nextBodyId = 0;
            clearSelection();
            simulationActive = false;
            currentG = 1.0;
            if (checkSimulation) checkSimulation.checked = false;
            if (slideG) slideG.value = 1.0;
            if (valG) valG.textContent = '1.0';
            syncPopulation();
        }, false);
    }

    if (btnInvertDir) {
        btnInvertDir.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedBody || !selectedBody.vel) return;
            window.vec3.negate(selectedBody.vel, selectedBody.vel);
            updateInspectorUI();
        }, false);
    }

    if (btnRepulsion) {
        btnRepulsion.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedBody) return;
            selectedBody.isRepelling = !selectedBody.isRepelling;
            updateInspectorUI();
        }, false);
    }

    if (btnZeroVelocity) {
        btnZeroVelocity.addEventListener('click', (e) => {
            e.preventDefault();
            if (!selectedBody || !selectedBody.vel) return;
            window.vec3.set(selectedBody.vel, 0, 0, 0);
            updateInspectorUI();
        }, false);
    }

    // ========== INTERSEÇÃO E CLIQUE POR PROXIMIDADE (RAY CASTING 2D) ==========
    canvas.addEventListener('click', (e) => {
        const hudPanel = document.getElementById('hud-panel');
        if (hudPanel && e.target && hudPanel.contains(e.target)) return;
        if (camera && camera.isDragging) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (mouseX < 0 || mouseY < 0 || mouseX > rect.width || mouseY > rect.height) {
            clearSelection();
            return;
        }

        let closestBody = null;
        let minDistance = Infinity;

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (!body || !body.pos) continue;
            
            const proj = camera.projectPoint(body.pos);
            if (!proj) continue; // Fora do Frustum de visão
            
            const dx = mouseX - proj.x;
            const dy = mouseY - proj.y;
            const dist2D = Math.sqrt(dx * dx + dy * dy);
            
            const visualRadius = Math.max(2, (body.radius || 6) * (550 / (550 + (proj.depth || 0))));
            const clickZone = visualRadius + 18; // Tolerância expandida para usabilidade móvel/mouse
            
            if (dist2D <= clickZone && dist2D < minDistance) {
                minDistance = dist2D;
                closestBody = body;
            }
        }

        if (closestBody) {
            selectedBody = closestBody;
            updateInspectorUI();
        } else {
            clearSelection();
        }
    }, false);

    canvas.addEventListener('mousemove', (e) => {
        if (camera && camera.isDragging) {
            canvas.style.cursor = 'grabbing';
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        let isOverBody = false;

        for (let body of bodies) {
            if (!body || !body.pos) continue;
            
            const proj = camera.projectPoint(body.pos);
            if (!proj) continue;
            
            const dx = mouseX - proj.x;
            const dy = mouseY - proj.y;
            const dist2D = Math.sqrt(dx * dx + dy * dy);
            const visualRadius = Math.max(2, (body.radius || 6) * (550 / (550 + (proj.depth || 0))));
            
            if (dist2D <= (visualRadius + 18)) {
                isOverBody = true;
                break;
            }
        }
        canvas.style.cursor = isOverBody ? 'pointer' : 'default';
    }, false);

    // ========== LOOP DE RENDEREZAÇÃO CONTÍNUO (60 FPS) ==========
    let lastTime = null;
    function run(nowMs) {
        if (lastTime === null) lastTime = nowMs;
        const dt = Math.min(0.016, (nowMs - lastTime) / 1000);
        lastTime = nowMs;

        // Limpeza com fator alpha constante para simular rastro cósmico de poeira (Motion Blur)
        ctx.fillStyle = "rgba(3, 3, 5, 0.15)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (camera && typeof camera.updateMatrices === 'function') {
            camera.updateMatrices();
        }

        const G = currentG;
        const softening = 0.5;

        if (spatialOctree && typeof spatialOctree.rebuild === 'function') {
            spatialOctree.rebuild(bodies);
        }

        try {
            if (simulationActive && bodies.length > 0) {
                if (spatialOctree && typeof spatialOctree.computeForces === 'function') {
                    spatialOctree.computeForces(bodies, G, 0.55, softening);
                } else if (typeof window.computeGravitationalForces === 'function') {
                    window.computeGravitationalForces(bodies, G, softening);
                }
            }

            if (typeof window.integrateBodies === 'function') {
                window.integrateBodies(bodies, dt, 500, spatialOctree.boundarySize);
            }
        } catch (err) {
            console.error('Erro na computação física:', err);
        }

        // Resolução mútua e par a par de colisões elásticas
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                if (bodies[i] && bodies[i].checkCollision) {
                    bodies[i].checkCollision(bodies[j]);
                }
            }
        }

        // Ordenação reversa do Z-Buffer (Algoritmo do Pintor) para evitar quebras de oclusão
        const renderedQueue = bodies
            .filter(body => body && body.pos)
            .map(body => {
                return { 
                    instance: body, 
                    proj: camera.projectPoint(body.pos) 
                };
            })
            .filter(item => item.proj !== null);

        renderedQueue.sort((a, b) => b.proj.depth - a.proj.depth);

        // Atualização em tempo real das coordenadas dinâmicas do card selecionado
        if (selectedBody && inspectorControls && !inspectorControls.classList.contains('hidden')) {
            const speed = Math.max(0, selectedBody.getSpeed ? selectedBody.getSpeed() : window.vec3.length(selectedBody.vel));
            if (selectedBodySpeed) selectedBodySpeed.textContent = `${speed.toFixed(2)} u/s`;
            
            if (selectedBodyPos && selectedBody.pos) {
                const px = selectedBody.pos[0].toFixed(0);
                const py = selectedBody.pos[1].toFixed(0);
                const pz = selectedBody.pos[2].toFixed(0);
                selectedBodyPos.textContent = `X:${px} Y:${py} Z:${pz}`;
            }
        }

        if (checkOctree && checkOctree.checked && spatialOctree && typeof spatialOctree.draw === 'function') {
            spatialOctree.draw(ctx, camera);
        }

        for (let item of renderedQueue) {
            const isSelected = selectedBody && (item.instance.id === selectedBody.id);
            if (item.instance.draw && typeof item.instance.draw === 'function') {
                item.instance.draw(ctx, camera, isSelected);
            }
        }

        requestAnimationFrame(run);
    }

    syncPopulation();
    requestAnimationFrame(run);
});