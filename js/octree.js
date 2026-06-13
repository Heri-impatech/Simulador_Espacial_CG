/**
 * js/octree.js
 * Estrutura de Dados Octree Adaptativa para Particionamento Espacial 3D
 */

class OctreeNode {
    constructor(cx, cy, cz, size, depth, maxDepth) {
        this.cx = cx; this.cy = cy; this.cz = cz;
        this.size = size; this.depth = depth; this.maxDepth = maxDepth;

        const half = size / 2;
        this.xMin = cx - half; this.xMax = cx + half;
        this.yMin = cy - half; this.yMax = cy + half;
        this.zMin = cz - half; this.zMax = cz + half;

        this.bodies = [];
        this.children = [];
        this.isDivided = false;
        this.mass = 0;
        this.centerOfMass = window.vec3.fromValues(cx, cy, cz);
        this.hasRepeller = false;
    }

    subdivide() {
        const nextSize = this.size / 2;
        const q = this.size / 4;
        const nextDepth = this.depth + 1;

        for (let xSign of [-1, 1]) {
            for (let ySign of [-1, 1]) {
                for (let zSign of [-1, 1]) {
                    const cx = this.cx + xSign * q;
                    const cy = this.cy + ySign * q;
                    const cz = this.cz + zSign * q;
                    this.children.push(new OctreeNode(cx, cy, cz, nextSize, nextDepth, this.maxDepth));
                }
            }
        }
        this.isDivided = true;

        for (let body of this.bodies) {
            this.insertIntoChildren(body);
        }
        this.bodies = [];
    }

    insertIntoChildren(body) {
        for (let child of this.children) {
            if (
                body.pos[0] >= child.xMin && body.pos[0] < child.xMax &&
                body.pos[1] >= child.yMin && body.pos[1] < child.yMax &&
                body.pos[2] >= child.zMin && body.pos[2] < child.zMax
            ) {
                child.insert(body);
                return true;
            }
        }
        return false;
    }

    insert(body) {
        const px = body.pos[0], py = body.pos[1], pz = body.pos[2];
        if (
            px < this.xMin || px > this.xMax ||
            py < this.yMin || py > this.yMax ||
            pz < this.zMin || pz > this.zMax
        ) {
            return false;
        }

        if (this.isDivided) {
            return this.insertIntoChildren(body);
        }

        this.bodies.push(body);

        const capacityLimit = 4;
        if (this.bodies.length > capacityLimit && this.depth < this.maxDepth) {
            this.subdivide();
        }
        return true;
    }

    computeMassDistribution() {
        if (this.isDivided) {
            let totalMass = 0;
            const com = window.vec3.create();
            let repeller = false;

            for (let child of this.children) {
                child.computeMassDistribution();
                totalMass += child.mass;
                window.vec3.scaleAndAdd(com, com, child.centerOfMass, child.mass);
                repeller = repeller || child.hasRepeller;
            }

            this.mass = totalMass;
            if (totalMass > 0) {
                window.vec3.scale(com, com, 1.0 / totalMass);
                window.vec3.copy(this.centerOfMass, com);
            }
            this.hasRepeller = repeller;
            return;
        }

        let totalMass = 0;
        const com = window.vec3.create();
        let repeller = false;

        for (let body of this.bodies) {
            totalMass += body.mass;
            window.vec3.scaleAndAdd(com, com, body.pos, body.mass);
            repeller = repeller || body.isRepelling;
        }

        this.mass = totalMass;
        if (totalMass > 0) {
            window.vec3.scale(com, com, 1.0 / totalMass);
            window.vec3.copy(this.centerOfMass, com);
        }
        this.hasRepeller = repeller;
    }

    accumulateForce(body, G, theta, softening) {
        if (!this.isDivided && this.bodies.length === 0) {
            return;
        }

        if (!this.isDivided) {
            for (let other of this.bodies) {
                if (other === body) continue;

                const dx = other.pos[0] - body.pos[0];
                const dy = other.pos[1] - body.pos[1];
                const dz = other.pos[2] - body.pos[2];
                const distSq = dx * dx + dy * dy + dz * dz + softening * softening;
                const dist = Math.sqrt(distSq);

                if (dist < 1e-9) continue;

                const forceMag = G * body.mass * other.mass / distSq;
                const dirX = dx / dist;
                const dirY = dy / dist;
                const dirZ = dz / dist;

                const ax = (forceMag / body.mass) * dirX;
                const ay = (forceMag / body.mass) * dirY;
                const az = (forceMag / body.mass) * dirZ;

                window.vec3.add(body.acc, body.acc, [ax, ay, az]);
            }
            return;
        }

        if (this.mass === 0) return;

        const direction = window.vec3.create();
        window.vec3.subtract(direction, this.centerOfMass, body.pos);
        const distSq = window.vec3.squaredLength(direction) + softening * softening;
        const dist = Math.sqrt(distSq);

        if (dist < 1e-9) {
            for (let child of this.children) {
                child.accumulateForce(body, G, theta, softening);
            }
            return;
        }

        if ((this.size / dist) < theta) {
            const forceMag = G * body.mass * this.mass / distSq;
            const dirX = direction[0] / dist;
            const dirY = direction[1] / dist;
            const dirZ = direction[2] / dist;

            const ax = (forceMag / body.mass) * dirX;
            const ay = (forceMag / body.mass) * dirY;
            const az = (forceMag / body.mass) * dirZ;

            window.vec3.add(body.acc, body.acc, [ax, ay, az]);
        } else {
            for (let child of this.children) {
                child.accumulateForce(body, G, theta, softening);
            }
        }
    }

    drawWireframe(ctx, camera) {
        if (this.isDivided) {
            for (let child of this.children) {
                child.drawWireframe(ctx, camera);
            }
            return;
        }

        if (this.bodies.length === 0) return;

        const h = this.size / 2;
        const rawVertices = [
            [this.cx - h, this.cy - h, this.cz - h],
            [this.cx + h, this.cy - h, this.cz - h],
            [this.cx + h, this.cy + h, this.cz - h],
            [this.cx - h, this.cy + h, this.cz - h],
            [this.cx - h, this.cy - h, this.cz + h],
            [this.cx + h, this.cy - h, this.cz + h],
            [this.cx + h, this.cy + h, this.cz + h],
            [this.cx - h, this.cy + h, this.cz + h]
        ];

        const projVertices = rawVertices.map(v => camera.projectPoint(v)).filter(p => p !== null);
        if (projVertices.length === 0) return;

        // Cor gradiente para octrees
        const depth = this.depth || 0;
        const maxDepth = this.maxDepth || 5;
        const depthRatio = depth / maxDepth;
        
        // Gradiente de cores: Ciano -> Roxo -> Magenta
        let r, g, b;
        if (depthRatio < 0.5) {
            // Ciano -> Roxo
            const t = depthRatio * 2;
            r = Math.floor(0 + (139 - 0) * t);
            g = Math.floor(210 + (92 - 210) * t);
            b = Math.floor(255 + (246 - 255) * t);
        } else {
            // Roxo -> Magenta/Azul
            const t = (depthRatio - 0.5) * 2;
            r = Math.floor(139 + (200 - 139) * t);
            g = Math.floor(92 + (100 - 92) * t);
            b = Math.floor(246 + (255 - 246) * t);
        }
        
        const opacity = 0.3 + (0.4 * (1 - depthRatio)); // Mais opaco para níveis superiores
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.lineWidth = Math.max(0.5, 1.5 - (depthRatio * 0.8));

        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7]
        ];

        for (let [i, j] of edges) {
            if (projVertices[i] && projVertices[j]) {
                ctx.beginPath();
                ctx.moveTo(projVertices[i].x, projVertices[i].y);
                ctx.lineTo(projVertices[j].x, projVertices[j].y);
                ctx.stroke();
            }
        }
    }
}

class Octree {
    constructor(boundarySize = 400, maxDepth = 5) {
        this.boundarySize = boundarySize;
        this.maxDepth = maxDepth;
        this.root = new OctreeNode(0, 0, 0, boundarySize, 0, maxDepth);
    }

    rebuild(bodiesList) {
        this.root = new OctreeNode(0, 0, 0, this.boundarySize, 0, this.maxDepth);
        for (let body of bodiesList) {
            if (body && body.pos) {
                this.root.insert(body);
            }
        }
        this.root.computeMassDistribution();
    }

    computeForces(bodiesList, G = 1.0, theta = 0.55, softening = 0.5) {
        // Resetar acelerações
        for (let body of bodiesList) {
            if (body && body.acc) {
                window.vec3.set(body.acc, 0, 0, 0);
            }
        }

        // Calcular forças usando octree
        for (let body of bodiesList) {
            if (body && body.pos) {
                this.root.accumulateForce(body, G, theta, softening);
            }
        }
    }

    draw(ctx, camera) {
        if (this.root) {
            this.root.drawWireframe(ctx, camera);
        }
    }
}

window.Octree = Octree;