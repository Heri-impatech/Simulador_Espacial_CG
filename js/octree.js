/**
 * js/octree.js
 * Estrutura de Dados Octree Adaptativa para Particionamento Espacial 3D
 */

class OctreeNode {
    constructor(cx, cy, cz, size, depth, maxDepth) {
        this.cx = cx;
        this.cy = cy;
        this.cz = cz;
        this.size = size;
        this.depth = depth;
        this.maxDepth = maxDepth;

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
                        this.cx + (xSign * q),
                        this.cy + (ySign * q),
                        this.cz + (zSign * q),
                        nextSize,
                        nextDepth,
                        this.maxDepth
                    ));
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
            if (body.pos[0] >= child.xMin && body.pos[0] <= child.xMax &&
                body.pos[1] >= child.yMin && body.pos[1] <= child.yMax &&
                body.pos[2] >= child.zMin && body.pos[2] <= child.zMax) {
                child.insert(body);
                return true;
            }
        }
        return false;
    }

    insert(body) {
        if (this.isDivided) {
            this.insertIntoChildren(body);
            return;
        }

        // MARCADOR DE FRONTEIRA: Dá à física a identidade da região espacial atual do corpo
        body.currentNodeId = `${this.cx.toFixed(0)}_${this.cy.toFixed(0)}_${this.cz.toFixed(0)}`;

        this.bodies.push(body);

        const capacityLimit = 4;
        if (this.bodies.length > capacityLimit && this.depth < this.maxDepth) {
            this.subdivide();
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
            [this.cx - h, this.cy - h, this.cz - h], [this.cx + h, this.cy - h, this.cz - h],
            [this.cx + h, this.cy + h, this.cz - h], [this.cx - h, this.cy + h, this.cz - h],
            [this.cx - h, this.cy - h, this.cz + h], [this.cx + h, this.cy - h, this.cz + h],
            [this.cx + h, this.cy + h, this.cz + h], [this.cx - h, this.cy + h, this.cz + h]
        ];

        const projVertices = rawVertices.map(v => camera.projectPoint(v));
        if (projVertices.some(v => v === null)) return;

        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0], 
            [4, 5], [5, 6], [6, 7], [7, 4], 
            [0, 4], [1, 5], [2, 6], [3, 7]  
        ];

        ctx.save();
        ctx.strokeStyle = `rgba(0, 210, 255, ${0.04 + (this.depth * 0.05)})`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();

        for (let edge of edges) {
            const p1 = projVertices[edge[0]];
            const p2 = projVertices[edge[1]];
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        }
        
        ctx.stroke();
        ctx.restore();
    }
}

class Octree {
    constructor(boundarySize = 600, maxDepth = 5) {
        this.boundarySize = boundarySize;
        this.maxDepth = maxDepth;
        this.root = null;
    }

    rebuild(bodiesList) {
        this.root = new OctreeNode(0, 0, 0, this.boundarySize, 0, this.maxDepth);
        for (let body of bodiesList) {
            this.root.insert(body);
        }
    }

    draw(ctx, camera) {
        if (this.root) {
            this.root.drawWireframe(ctx, camera);
        }
    }
}

window.OctreeNode = OctreeNode;
window.Octree = Octree;