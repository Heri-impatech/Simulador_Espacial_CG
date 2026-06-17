/**
 * js/octree.js
 * Malha Espacial Adaptativa e Marcador Tridimensional
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
    }

    subdivide() {
        const nextSize = this.size / 2;
        const q = this.size / 4;
        const nextDepth = this.depth + 1;

        for (let xSign of [-1, 1]) {
            for (let ySign of [-1, 1]) {
                for (let zSign of [-1, 1]) {
                    this.children.push(new OctreeNode(
                        this.cx + xSign * q, this.cy + ySign * q, this.cz + zSign * q, 
                        nextSize, nextDepth, this.maxDepth
                    ));
                }
            }
        }
        this.isDivided = true;

        for (let body of this.bodies) this.insertIntoChildren(body);
        this.bodies = [];
    }

    insertIntoChildren(body) {
        for (let child of this.children) {
            if (body.pos[0] >= child.xMin && body.pos[0] < child.xMax &&
                body.pos[1] >= child.yMin && body.pos[1] < child.yMax &&
                body.pos[2] >= child.zMin && body.pos[2] < child.zMax) {
                return child.insert(body);
            }
        }
        return false;
    }

    insert(body) {
        if (this.isDivided) return this.insertIntoChildren(body);

        // REGISTRO DE PROFUNDIDADE: Transmite a escala da malha para a física
        body.currentOctreeDepth = this.depth;

        this.bodies.push(body);

        // Critério severo de subdivisão cria malhas intrincadas ao redor de colisões
        if (this.bodies.length > 1 && this.depth < this.maxDepth) {
            this.subdivide();
        }
        return true;
    }

    drawWireframe(ctx, camera) {
        if (this.isDivided) {
            for (let child of this.children) child.drawWireframe(ctx, camera);
            return;
        }
        if (this.bodies.length === 0) return;

        const h = this.size / 2;
        const raw = [
            [this.cx - h, this.cy - h, this.cz - h], [this.cx + h, this.cy - h, this.cz - h],
            [this.cx + h, this.cy + h, this.cz - h], [this.cx - h, this.cy + h, this.cz - h],
            [this.cx - h, this.cy - h, this.cz + h], [this.cx + h, this.cy - h, this.cz + h],
            [this.cx + h, this.cy + h, this.cz + h], [this.cx - h, this.cy + h, this.cz + h]
        ];

        const proj = raw.map(v => camera.projectPoint(v)).filter(p => p !== null);
        if (proj.length === 0) return;

        // Tensão gravitacional afeta a cor da malha (Mais densa = Roxo/Vermelho)
        const depthRatio = this.depth / this.maxDepth;
        const r = Math.floor(0 + 255 * depthRatio);
        const g = Math.floor(210 - 200 * depthRatio);
        const b = 255;

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.1 + (depthRatio * 0.4)})`;
        ctx.lineWidth = 1.0 + depthRatio;
        
        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]
        ];

        for (let [i, j] of edges) {
            if (proj[i] && proj[j]) {
                ctx.beginPath();
                ctx.moveTo(proj[i].x, proj[i].y);
                ctx.lineTo(proj[j].x, proj[j].y);
                ctx.stroke();
            }
        }
    }
}

class Octree {
    constructor(boundarySize = 1200, maxDepth = 6) {
        this.boundarySize = boundarySize;
        this.maxDepth = maxDepth;
    }
    rebuild(bodiesList) {
        this.root = new OctreeNode(0, 0, 0, this.boundarySize, 0, this.maxDepth);
        for (let body of bodiesList) if (body && body.pos) this.root.insert(body);
    }
    draw(ctx, camera) {
        if (this.root) this.root.drawWireframe(ctx, camera);
    }
}
window.Octree = Octree;