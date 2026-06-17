/**
 * js/main.js
 * Orquestrador Estocástico N-Body com Liberação Dinâmica de UI
 */

window.addEventListener('load', () => {
    const canvas = document.getElementById('cosmosCanvas');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const camera = new window.Camera3D(canvas);
    const spatialOctree = new window.Octree(1200, 5); // Universo expandido

    let bodies = [];
    let selectedBody = null;
    let currentG = 1.0; 

    // Referências DOM
    const slideQty = document.getElementById('slide-qty');
    const slideG = document.getElementById('slide-g');
    const checkOctree = document.getElementById('check-octree');

    const inspectorControls = document.getElementById('inspector-controls');
    const slideBodyMass = document.getElementById('slide-body-mass');
    const valBodyMass = document.getElementById('val-body-mass');
    const slideBodySize = document.getElementById('slide-body-size');
    const valBodySize = document.getElementById('val-body-size');
    const slideBodySpeed = document.getElementById('slide-body-vx'); 
    const valBodySpeed = document.getElementById('val-body-vx');
    const btnRepulsion = document.getElementById('btn-repulsion');

    // ==============================================================
    // RIGOR DE ENGENHARIA: Quebrando os limites antigos do HTML
    // ==============================================================
    if (slideBodySize) { slideBodySize.min = 2; slideBodySize.max = 150; slideBodySize.step = 1; }
    if (slideBodyMass) { slideBodyMass.min = 0.1; slideBodyMass.max = 10000; slideBodyMass.step = 0.1; }
    if (slideBodySpeed) { slideBodySpeed.min = 0; slideBodySpeed.max = 5; slideBodySpeed.step = 0.1; }

    // Criação inicial com 7 Corpos Aleatórios
    function spawnRandomCluster(count) {
        bodies = [];
        for (let i = 0; i < count; i++) {
            const px = (Math.random() - 0.5) * 600;
            const py = (Math.random() - 0.5) * 600;
            const pz = (Math.random() - 0.5) * 600;

            const radius = 10 + Math.random() * 30;
            const body = new window.CelestialBody(px, py, pz, radius, i);

            const speed = 2.0 + Math.random() * 4.0; 
            const angleTheta = Math.random() * Math.PI * 2;
            const anglePhi = Math.acos((Math.random() * 2) - 1);

            const vx = speed * Math.sin(anglePhi) * Math.cos(angleTheta);
            const vy = speed * Math.sin(anglePhi) * Math.sin(angleTheta);
            const vz = speed * Math.cos(anglePhi);

            window.vec3.set(body.vel, vx, vy, vz);
            bodies.push(body);
        }
    }

    function clearSelection() {
        selectedBody = null;
        if (inspectorControls) inspectorControls.classList.add('hidden');
    }

    // Atualização Abstrata de UI (Sem unidades, totalmente desacoplado)
    function updateInspectorUI() {
        if (!selectedBody) return;
        inspectorControls.classList.remove('hidden');

        if (slideBodyMass) {
            slideBodyMass.value = selectedBody.mass;
            valBodyMass.textContent = selectedBody.mass.toFixed(1); 
        }

        if (slideBodySize) {
            slideBodySize.value = selectedBody.radius;
            valBodySize.textContent = selectedBody.radius.toFixed(1);
        }

        if (slideBodySpeed) {
            slideBodySpeed.value = selectedBody.speedMultiplier;
            valBodySpeed.textContent = selectedBody.speedMultiplier.toFixed(2);
        }
        
        if (btnRepulsion) {
            if (selectedBody.isRepelling) btnRepulsion.classList.add('active');
            else btnRepulsion.classList.remove('active');
        }
    }

    // Listeners Globais
    if (slideQty) slideQty.addEventListener('input', (e) => {
        clearSelection();
        spawnRandomCluster(parseInt(e.target.value));
    });

    if (slideG) slideG.addEventListener('input', (e) => currentG = parseFloat(e.target.value));

    // Desacoplamento Total de UI
    if (slideBodySize) slideBodySize.addEventListener('input', (e) => {
        if (selectedBody) {
            selectedBody.radius = parseFloat(e.target.value);
            // Re-renderiza a cor sem alterar a massa (massa e tamanho agora são independentes)
            selectedBody.color = selectedBody.generateCosmicColor();
        }
        updateInspectorUI();
    });

    if (slideBodyMass) slideBodyMass.addEventListener('input', (e) => {
        if (selectedBody) selectedBody.mass = parseFloat(e.target.value);
        updateInspectorUI();
    });

    if (slideBodySpeed) slideBodySpeed.addEventListener('input', (e) => {
        if (selectedBody) selectedBody.speedMultiplier = parseFloat(e.target.value);
        updateInspectorUI();
    });

    if (btnRepulsion) btnRepulsion.addEventListener('click', (e) => {
        e.preventDefault();
        if (selectedBody) {
            selectedBody.isRepelling = !selectedBody.isRepelling;
            updateInspectorUI();
        }
    });

    // Raycasting Normalizado
    canvas.addEventListener('click', (e) => {
        if (camera.isDragging) return;
        
        const rect = canvas.getBoundingClientRect();
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
            
            const hitZone = (visualRadius * 1.5) + 30; 
            if (dist2D <= hitZone && dist2D < minDistance) {
                minDistance = dist2D;
                closestBody = body;
            }
        }
        
        selectedBody = closestBody;
        if (selectedBody) updateInspectorUI();
        else clearSelection();
    });

    // LOOP PRINCIPAL (60 FPS)
    let lastTime = null;
    function run(nowMs) {
        if (lastTime === null) lastTime = nowMs;
        const dt = Math.min(0.016, (nowMs - lastTime) / 1000);
        lastTime = nowMs;

        ctx.fillStyle = "rgba(5, 5, 8, 0.4)"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        camera.updateMatrices();

        // A malha agora é reconstruída e lida ativamente pela Física
        spatialOctree.rebuild(bodies);
        
        // A gravidade agora é brutal e real
        window.computeGravitationalForces(bodies, currentG);

        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) bodies[i].checkCollision(bodies[j]);
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

    if (slideQty) slideQty.value = 7;
    spawnRandomCluster(7);
    requestAnimationFrame(run);
});