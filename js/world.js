// Sistema de Mundo Gigante e Câmera
export class World {
    constructor(width, height) {
        this.width = width;      // Largura do mundo (ex: 8000)
        this.height = height;    // Altura do mundo (ex: 6000)
        this.camera = { x: 0, y: 0 };
    }

    // Atualizar câmera para seguir o jogador
    updateCamera(playerX, playerY, canvasWidth, canvasHeight) {
        // Centralizar câmera no jogador
        this.camera.x = playerX - canvasWidth / 2;
        this.camera.y = playerY - canvasHeight / 2;
        
        // Limitar câmera nas bordas do mundo
        this.camera.x = Math.max(0, Math.min(this.width - canvasWidth, this.camera.x));
        this.camera.y = Math.max(0, Math.min(this.height - canvasHeight, this.camera.y));
    }

    // Converter coordenada do mundo para coordenada da tela
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.camera.x,
            y: worldY - this.camera.y
        };
    }

    // Verificar se um objeto está visível na tela (para otimização)
    isVisible(worldX, worldY, objectSize, canvasWidth, canvasHeight) {
        const screen = this.worldToScreen(worldX, worldY);
        return (screen.x + objectSize > 0 && 
                screen.x - objectSize < canvasWidth &&
                screen.y + objectSize > 0 && 
                screen.y - objectSize < canvasHeight);
    }

    // Gerar comida em posições aleatórias do mundo
    generateFood(count) {
        const foods = [];
        for (let i = 0; i < count; i++) {
            foods.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                value: 10 + Math.floor(Math.random() * 30)
            });
        }
        return foods;
    }

    // Verificar se posição está dentro dos limites do mundo
    isInsideWorld(x, y, margin = 0) {
        return (x >= margin && x <= this.width - margin &&
                y >= margin && y <= this.height - margin);
    }

    // Aplicar limites de mundo
    clampPosition(x, y, size) {
        return {
            x: Math.max(size, Math.min(this.width - size, x)),
            y: Math.max(size, Math.min(this.height - size, y))
        };
    }
}

// Minimapa (opcional - mostra visão geral do mundo)
export class MiniMap {
    constructor(world, canvas) {
        this.world = world;
        this.canvas = canvas;
        this.miniMapSize = 150;
        this.miniMapX = 10;
        this.miniMapY = 10;
    }

    draw(ctx, players, currentPlayer) {
        // Fundo do minimapa
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.miniMapX, this.miniMapY, this.miniMapSize, this.miniMapSize);
        
        ctx.strokeStyle = 'white';
        ctx.strokeRect(this.miniMapX, this.miniMapY, this.miniMapSize, this.miniMapSize);
        
        // Escala
        const scaleX = this.miniMapSize / this.world.width;
        const scaleY = this.miniMapSize / this.world.height;
        
        // Desenhar outros jogadores
        for (let id in players) {
            const p = players[id];
            if (!p) continue;
            
            const miniX = this.miniMapX + p.x * scaleX;
            const miniY = this.miniMapY + p.y * scaleY;
            
            if (id === currentPlayer?.id) {
                ctx.fillStyle = '#44FF44';
                ctx.beginPath();
                ctx.arc(miniX, miniY, 4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#FF4444';
                ctx.beginPath();
                ctx.arc(miniX, miniY, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Viewport da câmera
        const viewX = this.miniMapX + this.world.camera.x * scaleX;
        const viewY = this.miniMapY + this.world.camera.y * scaleY;
        const viewW = (this.canvas.width / this.world.width) * this.miniMapSize;
        const viewH = (this.canvas.height / this.world.height) * this.miniMapSize;
        
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(viewX, viewY, viewW, viewH);
    }
}