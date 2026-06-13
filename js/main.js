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
        const limit = 200; // Espaço para criação
        const px = (x !== null) ? x : (Math.random() - 0.5) * limit * 2;
        const py = (y !== null) ? y : (Math.random() - 0.5) * limit * 2;
        const pz = (z !== null) ? z : (Math.random() - 0.5) * limit * 2;
        
        const r = (radius !== null) ? radius : (5 + Math.random() * 15);
        const m = (mass !== null) ? mass : Math.pow(r / 6, 3) * 10.0;
        
        const body = new window.CelestialBody(px, py, pz, r, nextBodyId++);
        body.mass = Math.max(0.5, m);
        
        if (!body.vel) body.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
        if (!body.acc) body.acc = window.vec3 ? window.vec3.create() : [0, 0, 0];
        
        // NOVO: Velocidade inicial aleatória para interação entre corpos
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5; // Velocidade entre 0.5 e 2.0
        
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
            
            // Criar corpos com velocidades iniciais
            for (let i = 0; i < targetQty; i++) {
                const body = createRandomBody();
                bodies.push(body);
            }
            
            clearSelection();
            
            // AUTO-ATIVAR simulação se houver velocidades
            const hasVelocity = bodies.some(b => b.vel && window.vec3.length(b.vel) > 0.05);
            if (hasVelocity) {
                simulationActive = true;
                if (checkSimulation) checkSimulation.checked = true;
            }
            
            console.log(`✓ ${targetQty} corpos criados em posições aleatórias com velocidade inicial!`);
            console.log(`✓ Clique em um corpo para selecionar e editar`);
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

    // ========== INICIALIZAÇÃO ==========
    console.log('═══════════════════════════════════════');
    console.log('🚀 SIMULADOR ESPACIAL 3D - INICIANDO');
    console.log('═══════════════════════════════════════');
    console.log('✓ Canvas encontrado');
    console.log('✓ Camera 3D inicializada');
    console.log('✓ Octree preparada');
    console.log('✓ Sistema de seleção ativo');
    console.log('✓ Controles de edição preparados');
    console.log('');
    console.log('📖 INSTRUÇÕES:');
    console.log('  1. Clique em um corpo para selecioná-lo');
    console.log('  2. Use os sliders para alterar massa, tamanho e velocidade');
    console.log('  3. Botões: Inverter direção | Alternar Repulsão | Parar');
    console.log('═══════════════════════════════════════');
    console.log('');

    function updateInspectorUI() {
        if (!selectedBody) {
            clearSelection();
            return;
        }

        // Garantir que os elementos existem
        if (!inspectorControls || !noSelectionMsg) {
            console.error('Elementos do inspector não encontrados');
            return;
        }

        // Mostrar controles, esconder mensagem
        inspectorControls.classList.remove('hidden');
        noSelectionMsg.classList.add('hidden');

        // Garantir que vel e acc existem
        if (!selectedBody.vel) selectedBody.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
        if (!selectedBody.acc) selectedBody.acc = window.vec3 ? window.vec3.create() : [0, 0, 0];

        // ========== ATUALIZAR CARD DO CORPO ==========
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
        
        if (selectedBodyPos) {
            const px = selectedBody.pos[0].toFixed(0);
            const py = selectedBody.pos[1].toFixed(0);
            const pz = selectedBody.pos[2].toFixed(0);
            selectedBodyPos.textContent = `X:${px} Y:${py} Z:${pz}`;
        }

        // ========== ATUALIZAR SLIDERS DE MASSA ==========
        const mass = Math.max(0.5, selectedBody.mass || 1.0);
        if (slideBodyMass) {
            slideBodyMass.value = mass;
        }
        if (valBodyMass) {
            valBodyMass.textContent = mass.toFixed(2);
        }

        // ========== ATUALIZAR SLIDERS DE TAMANHO ==========
        const radius = Math.max(2, selectedBody.radius || 6);
        if (slideBodySize) {
            slideBodySize.value = radius;
        }
        if (valBodySize) {
            valBodySize.textContent = radius.toFixed(1);
        }

        // ========== ATUALIZAR SLIDERS DE VELOCIDADE ==========
        const vx = parseFloat(selectedBody.vel[0]) || 0;
        const vy = parseFloat(selectedBody.vel[1]) || 0;
        const vz = parseFloat(selectedBody.vel[2]) || 0;

        if (slideBodyVx) slideBodyVx.value = vx;
        if (valBodyVx) valBodyVx.textContent = vx.toFixed(2);

        if (slideBodyVy) slideBodyVy.value = vy;
        if (valBodyVy) valBodyVy.textContent = vy.toFixed(2);

        if (slideBodyVz) slideBodyVz.value = vz;
        if (valBodyVz) valBodyVz.textContent = vz.toFixed(2);

        // ========== ATUALIZAR BOTÃO DE REPULSÃO ==========
        if (btnRepulsion) {
            const isRepelling = selectedBody.isRepelling || false;
            if (isRepelling) {
                btnRepulsion.classList.add('active');
            } else {
                btnRepulsion.classList.remove('active');
            }
        }

        console.log(`🔄 UI atualizado para Corpo #${selectedBody.id}`);
    }

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

    if (slideBodyMass) {
        const updateMass = (e) => {
            if (!selectedBody) {
                console.warn('⚠️ Nenhum corpo selecionado para alterar massa');
                return;
            }
            const newMass = Math.max(0.5, parseFloat(e.target.value) || 1.0);
            selectedBody.mass = newMass;
            if (valBodyMass) valBodyMass.textContent = newMass.toFixed(2);
            console.log(`✓ Massa do Corpo #${selectedBody.id} alterada para ${newMass.toFixed(2)} kg`);
        };
        slideBodyMass.addEventListener('input', updateMass, false);
        slideBodyMass.addEventListener('change', updateMass, false);
    }

    if (slideBodySize) {
        const updateSize = (e) => {
            if (!selectedBody) {
                console.warn('⚠️ Nenhum corpo selecionado para alterar tamanho');
                return;
            }
            const newRadius = Math.max(2, parseFloat(e.target.value) || 6);
            selectedBody.radius = newRadius;
            if (valBodySize) valBodySize.textContent = newRadius.toFixed(1);
            
            // Recalcular cor baseada no novo tamanho
            if (selectedBody.generateCosmicColor && typeof selectedBody.generateCosmicColor === 'function') {
                selectedBody.color = selectedBody.generateCosmicColor();
            }
            console.log(`✓ Tamanho do Corpo #${selectedBody.id} alterado para ${newRadius.toFixed(1)} px`);
        };
        slideBodySize.addEventListener('input', updateSize, false);
        slideBodySize.addEventListener('change', updateSize, false);
    }

    // ========== CONTROLES DE VELOCIDADE COM RIGOR ==========
    function setupVelocityControl(slideElement, valElement, velocityIndex, axisName) {
        if (!slideElement || !valElement) {
            console.warn(`⚠️ Elemento do slider de velocidade ${axisName} não encontrado`);
            return;
        }
        
        // Configurar atributos do slider
        slideElement.setAttribute('min', '-5');
        slideElement.setAttribute('max', '5');
        slideElement.setAttribute('step', '0.1');
        slideElement.setAttribute('value', '0');
        
        const updateVelocity = (e) => {
            if (!selectedBody) {
                console.warn(`⚠️ Nenhum corpo selecionado para alterar velocidade (${axisName})`);
                return;
            }
            
            // Garantir que vel existe
            if (!selectedBody.vel || !Array.isArray(selectedBody.vel)) {
                selectedBody.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
            }
            
            const newValue = parseFloat(e.target.value) || 0;
            selectedBody.vel[velocityIndex] = newValue;
            
            // Atualizar display
            valElement.textContent = newValue.toFixed(2);
            
            // Calcular velocidade total
            const speed = window.vec3.length(selectedBody.vel);
            console.log(`✓ Velocidade ${axisName} do Corpo #${selectedBody.id} = ${newValue.toFixed(2)} (total: ${speed.toFixed(2)} u/s)`);
            
            // Auto-ativar simulação se houver velocidade significativa
            if (speed > 0.05 && !simulationActive) {
                simulationActive = true;
                if (checkSimulation) checkSimulation.checked = true;
                console.log('✓ Simulação ativada automaticamente');
            }
            
            // Atualizar UI inspector
            updateInspectorUI();
        };
        
        slideElement.addEventListener('input', updateVelocity, false);
        slideElement.addEventListener('change', updateVelocity, false);
    }

    // Configurar controles de velocidade para os 3 eixos
    setupVelocityControl(slideBodyVx, valBodyVx, 0, 'X (Esquerda-Direita)');
    setupVelocityControl(slideBodyVy, valBodyVy, 1, 'Y (Cima-Baixo)');
    setupVelocityControl(slideBodyVz, valBodyVz, 2, 'Z (Frente-Trás)');

    // ========== BOTÕES DE AÇÃO COM RIGOR ==========

    if (btnResetScene) {
        btnResetScene.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            bodies = [];
            nextBodyId = 0;
            clearSelection();
            simulationActive = false;
            currentG = 1.0;
            if (checkSimulation) checkSimulation.checked = false;
            if (slideG) slideG.value = 1.0;
            if (valG) valG.textContent = '1.0';
            console.log('🔄 Cena reiniciada');
            syncPopulation();
        }, false);
    }

    // Botão: Inverter Direção
    if (btnInvertDir) {
        btnInvertDir.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!selectedBody) {
                console.warn('⚠️ Nenhum corpo selecionado para inverter');
                return;
            }
            if (!selectedBody.vel) {
                selectedBody.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
            }
            window.vec3.negate(selectedBody.vel, selectedBody.vel);
            updateInspectorUI();
            console.log(`✓ Velocidade invertida para Corpo #${selectedBody.id}`);
        }, false);
    }

    // Botão: Alternar Repulsão
    if (btnRepulsion) {
        btnRepulsion.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!selectedBody) {
                console.warn('⚠️ Nenhum corpo selecionado para alternar repulsão');
                return;
            }
            selectedBody.isRepelling = !selectedBody.isRepelling;
            btnRepulsion.classList.toggle('active', selectedBody.isRepelling);
            console.log(`✓ Corpo #${selectedBody.id} modo ${selectedBody.isRepelling ? '💥 REPULSÃO' : '🌍 ATRAÇÃO'}`);
            updateInspectorUI();
        }, false);
    }

    // Botão: Parar Velocidade (Zerar)
    if (btnZeroVelocity) {
        btnZeroVelocity.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!selectedBody) {
                console.warn('⚠️ Nenhum corpo selecionado para parar');
                return;
            }
            if (!selectedBody.vel) {
                selectedBody.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
            }
            window.vec3.set(selectedBody.vel, 0, 0, 0);
            updateInspectorUI();
            console.log(`✓ Velocidade zerada para Corpo #${selectedBody.id}`);
        }, false);
    }

    // SISTEMA DE SELEÇÃO COM RIGOR - Detecta cliques nos corpos
    canvas.addEventListener('click', (e) => {
        // Não processar se clicou na sidebar
        const hudPanel = document.getElementById('hud-panel');
        if (hudPanel && e.target && hudPanel.contains(e.target)) {
            return;
        }

        // Não processar durante rotação de câmera
        if (camera && camera.isDragging) {
            console.log('Camera em movimento - clique ignorado');
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Validação básica
        if (mouseX < 0 || mouseY < 0 || mouseX > rect.width || mouseY > rect.height) {
            clearSelection();
            return;
        }

        let closestBody = null;
        let minDistance = Infinity;

        console.log(`🔍 Procurando corpos... Total: ${bodies.length}`);

        // RIGOR: Iterar sobre todos os corpos e encontrar o mais próximo
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            
            if (!body || !body.pos) {
                console.warn(`Corpo ${i} inválido`);
                continue;
            }
            
            // Projetar posição 3D do corpo na tela
            const proj = camera.projectPoint(body.pos);
            if (!proj) {
                continue; // Corpo fora da câmera
            }
            
            // Calcular distância 2D do mouse até o corpo
            const dx = mouseX - proj.x;
            const dy = mouseY - proj.y;
            const dist2D = Math.sqrt(dx * dx + dy * dy);
            
            // Calcular raio visual do corpo
            const visualRadius = Math.max(2, (body.radius || 6) * (550 / (550 + (proj.depth || 0))));
            
            // Zona de clique expandida para usabilidade
            const clickZone = visualRadius + 18;
            
            console.log(`  Corpo #${body.id}: dist=${dist2D.toFixed(1)}, radius=${visualRadius.toFixed(1)}, zone=${clickZone.toFixed(1)}`);
            
            // Se dentro da zona e é o mais próximo
            if (dist2D <= clickZone && dist2D < minDistance) {
                minDistance = dist2D;
                closestBody = body;
                console.log(`    ✓ Candidato válido!`);
            }
        }

        // Selecionar ou desselecionar
        if (closestBody) {
            selectedBody = closestBody;
            console.log(`\n✅ CORPO #${closestBody.id} SELECIONADO`);
            console.log(`   Massa: ${closestBody.mass.toFixed(2)} kg`);
            console.log(`   Raio: ${closestBody.radius.toFixed(1)} px`);
            console.log(`   Velocidade: ${window.vec3.length(closestBody.vel).toFixed(2)} u/s\n`);
            updateInspectorUI();
        } else {
            clearSelection();
            console.log('❌ Nenhum corpo na zona de clique');
        }
    }, false);

    // Efeito visual de cursor ao passar sobre corpos
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
            const clickZone = visualRadius + 18;
            
            if (dist2D <= clickZone) {
                isOverBody = true;
                break;
            }
        }

        canvas.style.cursor = isOverBody ? 'pointer' : (camera && camera.isDragging ? 'grabbing' : 'default');
    }, false);

    let lastTime = null;
    function run(nowMs) {
        if (lastTime === null) lastTime = nowMs;
        const dt = Math.min(0.016, (nowMs - lastTime) / 1000);
        lastTime = nowMs;

        ctx.fillStyle = "rgba(3,3,5,0.15)";
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
            console.error('Erro na física:', err);
        }

        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                if (bodies[i] && bodies[i].checkCollision) {
                    bodies[i].checkCollision(bodies[j]);
                }
            }
        }

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

        // Atualizar inspector em tempo real se houver corpo selecionado
        if (selectedBody && inspectorControls && !inspectorControls.classList.contains('hidden')) {
            // Atualizar informações que mudam constantemente
            const speed = Math.max(0, selectedBody.getSpeed ? selectedBody.getSpeed() : window.vec3.length(selectedBody.vel));
            if (selectedBodySpeed) selectedBodySpeed.textContent = `${speed.toFixed(2)} u/s`;
            
            if (selectedBodyPos) {
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
    
    console.log('═══════════════════════════════════════');
    console.log('✅ SIMULADOR INICIALIZADO COM SUCESSO!');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('🎮 COMO USAR:');
    console.log('  • CLIQUE EM UM CORPO para selecioná-lo');
    console.log('  • ARRASTE COM O MOUSE para rotar câmera');
    console.log('  • RODA DO MOUSE para zoom in/out');
    console.log('');
    console.log('⚙️ CONTROLES DO CORPO SELECIONADO:');
    console.log('  • Slider MASSA: De 0.5 a 10 kg');
    console.log('  • Slider TAMANHO: De 2 a 30 px');
    console.log('  • Slider VELOCIDADE X/Y/Z: De -5 a +5 u/s');
    console.log('  • Botão INVERTER: Inverte direção');
    console.log('  • Botão REPULSÃO: Alterna atração/repulsão');
    console.log('  • Botão PARAR: Zera a velocidade');
    console.log('═══════════════════════════════════════');
});