/**
 * js/main.js
 * Orquestração N-Corpos Aleatória com Seleção de Escala Normalizada
 */

window.addEventListener('load', () => {
    const canvas = document.getElementById('cosmosCanvas');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const camera = new window.Camera3D(canvas);
    const spatialOctree = new window.Octree(600, 5);

    let bodies = [];
    let selectedBody = null;
    let currentG = 1.0; 

    // Referências DOM
    const slideQty = document.getElementById('slide-qty');
    const valQty = document.getElementById('val-qty');
    const slideG = document.getElementById('slide-g');
    const valG = document.getElementById('val-g');
    const checkOctree = document.getElementById('check-octree');

    const inspectorControls = document.getElementById('inspector-controls');
    const slideBodyMass = document.getElementById('slide-body-mass');
    const valBodyMass = document.getElementById('val-body-mass');
    const slideBodySize = document.getElementById('slide-body-size');
    const valBodySize = document.getElementById('val-body-size');
    const slideBodySpeed = document.getElementById('slide-body-vx'); // Slider Mestre de Velocidade
    const valBodySpeed = document.getElementById('val-body-vx');
    
    const btnRepulsion = document.getElementById('btn-repulsion');
    const btnInvertDir = document.getElementById('btn-invert-dir');

    // 1. Gera Aglomerado Estelar Randômico (Substitui o Sistema Solar Estático)
    function spawnRandomCluster(count) {
        bodies = [];
        for (let i = 0; i < count; i++) {
            // Posição no núcleo do espaço
            const px = (Math.random() - 0.5) * 300;
            const py = (Math.random() - 0.5) * 300;
            const pz = (Math.random() - 0.5) * 300;

            // Raio entre 15 e 35 para garantir visibilidade alta
            const radius = 15 + Math.random() * 20;
            const body = new window.CelestialBody(px, py, pz, radius, i);

            // Velocidades energéticas iniciais usando distribuição esférica
            const speed = 2.0 + Math.random() * 3.5; 
            const angleTheta = Math.random() * Math.PI * 2;
            const anglePhi = Math.acos((Math.random() * 2) - 1);

            const vx = speed * Math.sin(anglePhi) * Math.cos(angleTheta);
            const vy = speed * Math.sin(anglePhi) * Math.sin(angleTheta);
            const vz = speed * Math.cos(anglePhi);

            window.vec3.set(body.vel, vx, vy, vz);
            bodies.push(body);
        }
    }

    function syncPopulation() {
        const targetQty = parseInt(slideQty.value) || 7;
        if (valQty) valQty.textContent = targetQty;

        if (bodies.length !== targetQty) {
            clearSelection();
            spawnRandomCluster(targetQty);
        }
    }

    function clearSelection() {
        selectedBody = null;
        if (inspectorControls) inspectorControls.classList.add('hidden');
    }

    // Oculta unidades explícitas e atualiza dados
    function updateInspectorUI() {
        if (!selectedBody) return;
        if (inspectorControls) inspectorControls.classList.remove('hidden');

        const mass = Math.max(0.5, selectedBody.mass);
        if (slideBodyMass) slideBodyMass.value = mass;
        if (valBodyMass) valBodyMass.textContent = mass.toFixed(0); 

        const radius = Math.max(2, selectedBody.radius);
        if (slideBodySize) slideBodySize.value = radius;
        if (valBodySize) valBodySize.textContent = radius.toFixed(1);

        if (slideBodySpeed) slideBodySpeed.value = selectedBody.speedMultiplier;
        if (valBodySpeed) valBodySpeed.textContent = selectedBody.speedMultiplier.toFixed(2);
        
        if (btnRepulsion) {
            if (selectedBody.isRepelling) btnRepulsion.classList.add('active');
            else btnRepulsion.classList.remove('active');
        }
    }

    // Listeners do Menu Global
    if (slideQty) slideQty.addEventListener('input', syncPopulation);
    if (slideG) slideG.addEventListener('input', (e) => {
        currentG = parseFloat(e.target.value);
        if (valG) valG.textContent = currentG.toFixed(1);
    });

    // Listeners do Menu Individual
    if (slideBodyMass) slideBodyMass.addEventListener('input', (e) => {
        if (selectedBody) selectedBody.mass = parseFloat(e.target.value);
        updateInspectorUI();
    });

    if (slideBodySize) slideBodySize.addEventListener('input', (e) => {
        if (selectedBody) {
            selectedBody.radius = parseFloat(e.target.value);
            selectedBody.mass = Math.pow(selectedBody.radius, 3) * 0.002; 
            selectedBody.color = selectedBody.generateCosmicColor();
        }
        updateInspectorUI();
    });

    if (slideBodySpeed) slideBodySpeed.addEventListener('input', (e) => {
        if (selectedBody) selectedBody.speedMultiplier = parseFloat(e.target.value);
        updateInspectorUI();
    });
    
    if (btnRepulsion) btnRepulsion.addEventListener('click', () => {
        if (selectedBody) {
            selectedBody.isRepelling = !selectedBody.isRepelling;
            updateInspectorUI();
        }
    });
    
    if (btnInvertDir) btnInvertDir.addEventListener('click', () => {
        if (selectedBody) {
            window.vec3.negate(selectedBody.vel, selectedBody.vel);
        }
    });

    // 2. RAY CASTING DE SELEÇÃO CALIBRADO COM NORMALIZAÇÃO DE RESOLUÇÃO
    canvas.addEventListener('click', (e) => {
        if (camera.isDragging) return;
        
        const rect = canvas.getBoundingClientRect();
        
        // Fator de correção de tela (essencial para o clique funcionar)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        let closestBody = null;
        let minDistance = Infinity;

        for (let body of bodies) {
            const proj = camera.projectPoint(body.pos);
            if (!proj) continue;
            
            const dist2D = Math.sqrt(Math.pow(mouseX - proj.x, 2) + Math.pow(mouseY - proj.y, 2));
            const visualRadius = Math.max(5, body.radius * (550 / (550 + proj.depth)));
            
            // Hitbox expandida para corpos em movimento rápido
            const hitZone = (visualRadius * 1.5) + 30; 
            
            if (dist2D <= hitZone && dist2D < minDistance) {
                minDistance = dist2D;
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

    // 3. LOOP DE ANIMAÇÃO
    let lastTime = null;
    function run(nowMs) {
        if (lastTime === null) lastTime = nowMs;
        const dt = Math.min(0.016, (nowMs - lastTime) / 1000);
        lastTime = nowMs;

        // Limpeza com rastro
        ctx.fillStyle = "rgba(3, 3, 5, 0.25)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        camera.updateMatrices();

        spatialOctree.rebuild(bodies);
        window.computeGravitationalForces(bodies, currentG, 1.0);

        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                bodies[i].checkCollision(bodies[j]);
            }
        }

        for (let body of bodies) body.integrate(dt, spatialOctree.boundarySize);

        const renderedQueue = bodies.map(b => ({ instance: b, proj: camera.projectPoint(b.pos) })).filter(i => i.proj !== null);
        renderedQueue.sort((a, b) => b.proj.depth - a.proj.depth);

        if (checkOctree && checkOctree.checked) spatialOctree.draw(ctx, camera);

        for (let item of renderedQueue) {
            item.instance.draw(ctx, camera, selectedBody && item.instance.id === selectedBody.id);
        }

        requestAnimationFrame(run);
    }

    // START
    if (slideQty) slideQty.value = 7;
    syncPopulation();
    requestAnimationFrame(run);
});