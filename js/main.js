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

    // BUG FIX: Corpos em posições ALEATÓRIAS, sem centro fixo
    function createRandomBody(x = null, y = null, z = null, mass = null, radius = null) {
        const limit = 200; // Aumentado para mais espaço
        const px = (x !== null) ? x : (Math.random() - 0.5) * limit * 2;
        const py = (y !== null) ? y : (Math.random() - 0.5) * limit * 2;
        const pz = (z !== null) ? z : (Math.random() - 0.5) * limit * 2;
        
        const r = (radius !== null) ? radius : (5 + Math.random() * 15);
        const m = (mass !== null) ? mass : Math.pow(r / 6, 3) * 10.0;
        
        const body = new window.CelestialBody(px, py, pz, r, nextBodyId++);
        body.mass = Math.max(0.5, m);
        
        if (!body.vel) body.vel = window.vec3 ? window.vec3.create() : [0, 0, 0];
        if (!body.acc) body.acc = window.vec3 ? window.vec3.create() : [0, 0, 0];
        
        window.vec3.set(body.vel, 0, 0, 0);
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
            
            // BUG FIX: Todos os corpos em posições ALEATÓRIAS
            for (let i = 0; i < targetQty; i++) {
                const body = createRandomBody();
                bodies.push(body);
            }
            
            clearSelection();
            simulationActive = false;
            if (checkSimulation) checkSimulation.checked = false;
            console.log(`✓ ${targetQty} corpos criados em posições aleatórias. Clique em um corpo para começar!`);
        }
    }

    function clearSelection() {
        selectedBody = null;
        if (inspectorControls) inspectorControls.classList.add('hidden');
        if (noSelectionMsg) noSelectionMsg.classList.remove('hidden');
        if (btnRepulsion) btnRepulsion.classList.remove('active');
    }

    function updateInspectorUI() {
        if (!selectedBody) {
            clearSelection();
            return;
        }

        if (inspectorControls) inspectorControls.classList.remove('hidden');
        if (noSelectionMsg) noSelectionMsg.classList.add('hidden');

        if (!selectedBody.vel) selectedBody.vel = [0, 0, 0];
        if (!selectedBody.acc) selectedBody.acc = [0, 0, 0];

        const mass = Math.max(0.5, selectedBody.mass || 1.0);
        if (valBodyMass) valBodyMass.textContent = mass.toFixed(2);
        if (slideBodyMass) slideBodyMass.value = mass;

        const radius = Math.max(2, selectedBody.radius || 6);
        if (valBodySize) valBodySize.textContent = radius.toFixed(1);
        if (slideBodySize) slideBodySize.value = radius;

        const vx = parseFloat(selectedBody.vel[0]) || 0;
        const vy = parseFloat(selectedBody.vel[1]) || 0;
        const vz = parseFloat(selectedBody.vel[2]) || 0;

        if (valBodyVx) valBodyVx.textContent = vx.toFixed(2);
        if (slideBodyVx) slideBodyVx.value = vx;

        if (valBodyVy) valBodyVy.textContent = vy.toFixed(2);
        if (slideBodyVy) slideBodyVy.value = vy;

        if (valBodyVz) valBodyVz.textContent = vz.toFixed(2);
        if (slideBodyVz) slideBodyVz.value = vz;

        if (btnRepulsion) {
            const isRepelling = selectedBody.isRepelling || false;
            btnRepulsion.classList.toggle('active', isRepelling);
        }
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
        slideBodyMass.addEventListener('input', (e) => {
            if (!selectedBody) return;
            const newMass = Math.max(0.5, parseFloat(e.target.value) || 1.0);
            selectedBody.mass = newMass;
            if (valBodyMass) valBodyMass.textContent = newMass.toFixed(2);
        });
    }

    if (slideBodySize) {
        slideBodySize.addEventListener('input', (e) => {
            if (!selectedBody) return;
            const newRadius = Math.max(2, parseFloat(e.target.value) || 6);
            selectedBody.radius = newRadius;
            if (valBodySize) valBodySize.textContent = newRadius.toFixed(1);
            if (selectedBody.generateCosmicColor) {
                selectedBody.color = selectedBody.generateCosmicColor();
            }
        });
    }

    // BUG FIX: Velocidades podem ser maiores (range até ±10)
    if (slideBodyVx) {
        slideBodyVx.addEventListener('input', (e) => {
            if (!slideBodyVx) return;
            slideBodyVx.min = "-10";
            slideBodyVx.max = "10";
            
            if (!selectedBody) return;
            const vx = parseFloat(e.target.value) || 0;
            if (!selectedBody.vel) selectedBody.vel = [0, 0, 0];
            selectedBody.vel[0] = vx;
            if (valBodyVx) valBodyVx.textContent = vx.toFixed(2);
            
            const hasVelocity = Math.abs(selectedBody.vel[0]) > 0.01 || 
                               Math.abs(selectedBody.vel[1] || 0) > 0.01 || 
                               Math.abs(selectedBody.vel[2] || 0) > 0.01;
            if (hasVelocity && !simulationActive) {
                simulationActive = true;
                if (checkSimulation) checkSimulation.checked = true;
            }
        });
    }

    if (slideBodyVy) {
        slideBodyVy.addEventListener('input', (e) => {
            if (!slideBodyVy) return;
            slideBodyVy.min = "-10";
            slideBodyVy.max = "10";
            
            if (!selectedBody) return;
            const vy = parseFloat(e.target.value) || 0;
            if (!selectedBody.vel) selectedBody.vel = [0, 0, 0];
            selectedBody.vel[1] = vy;
            if (valBodyVy) valBodyVy.textContent = vy.toFixed(2);
            
            const hasVelocity = Math.abs(selectedBody.vel[0] || 0) > 0.01 || 
                               Math.abs(selectedBody.vel[1]) > 0.01 || 
                               Math.abs(selectedBody.vel[2] || 0) > 0.01;
            if (hasVelocity && !simulationActive) {
                simulationActive = true;
                if (checkSimulation) checkSimulation.checked = true;
            }
        });
    }

    if (slideBodyVz) {
        slideBodyVz.addEventListener('input', (e) => {
            if (!slideBodyVz) return;
            slideBodyVz.min = "-10";
            slideBodyVz.max = "10";
            
            if (!selectedBody) return;
            const vz = parseFloat(e.target.value) || 0;
            if (!selectedBody.vel) selectedBody.vel = [0, 0, 0];
            selectedBody.vel[2] = vz;
            if (valBodyVz) valBodyVz.textContent = vz.toFixed(2);
            
            const hasVelocity = Math.abs(selectedBody.vel[0] || 0) > 0.01 || 
                               Math.abs(selectedBody.vel[1] || 0) > 0.01 || 
                               Math.abs(selectedBody.vel[2]) > 0.01;
            if (hasVelocity && !simulationActive) {
                simulationActive = true;
                if (checkSimulation) checkSimulation.checked = true;
            }
        });
    }

    if (btnInvertDir) {
        btnInvertDir.addEventListener('click', () => {
            if (!selectedBody || !selectedBody.vel) return;
            window.vec3.scale(selectedBody.vel, selectedBody.vel, -1);
            updateInspectorUI();
        });
    }

    if (btnRepulsion) {
        btnRepulsion.addEventListener('click', () => {
            if (!selectedBody) return;
            selectedBody.isRepelling = !selectedBody.isRepelling;
            btnRepulsion.classList.toggle('active', selectedBody.isRepelling);
        });
    }

    if (btnZeroVelocity) {
        btnZeroVelocity.addEventListener('click', () => {
            if (!selectedBody) return;
            if (!selectedBody.vel) selectedBody.vel = [0, 0, 0];
            window.vec3.set(selectedBody.vel, 0, 0, 0);
            updateInspectorUI();
        });
    }

    if (btnResetScene) {
        btnResetScene.addEventListener('click', () => {
            bodies = [];
            nextBodyId = 0;
            clearSelection();
            simulationActive = false;
            currentG = 1.0;
            if (checkSimulation) checkSimulation.checked = false;
            if (slideG) slideG.value = 1.0;
            if (valG) valG.textContent = '1.0';
            syncPopulation();
        });
    }

    canvas.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('#hud-panel')) return;
        if (camera && camera.isDragging) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let closestBody = null;
        let minScreenDistance = Infinity;

        for (let body of bodies) {
            if (!body || !body.pos) continue;
            
            const proj = camera.projectPoint(body.pos);
            if (!proj) continue;
            
            const dist2D = Math.hypot(mouseX - proj.x, mouseY - proj.y);
            const visualRadius = (body.radius || 6) * (550 / (550 + (proj.depth || 0)));
            
            if (dist2D < visualRadius + 15 && dist2D < minScreenDistance) {
                minScreenDistance = dist2D;
                closestBody = body;
            }
        }

        if (closestBody) {
            selectedBody = closestBody;
            updateInspectorUI();
        } else {
            clearSelection();
        }
    });

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