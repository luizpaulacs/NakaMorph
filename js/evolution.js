export const EvolutionSystem = {
    stages: [
        { id: 1, name: "Novato", shape: "circle", color: "#FFFFFF", minLevel: 1, bonus: { speed: 0, size: 0, collect: 0 } },
        { id: 2, name: "Bronze", shape: "circle", color: "#CD7F32", minLevel: 5, bonus: { speed: 5, size: 0, collect: 0 } },
        { id: 3, name: "Prata", shape: "circle", color: "#C0C0C0", minLevel: 10, bonus: { speed: 10, size: 5, collect: 5 } },
        { id: 4, name: "Ouro", shape: "circle", color: "#FFD700", minLevel: 20, bonus: { speed: 15, size: 10, collect: 10 } },
        { id: 5, name: "Platina", shape: "circle", color: "#00CED1", minLevel: 35, bonus: { speed: 20, size: 15, collect: 15 } },
        { id: 6, name: "Diamante", shape: "square", color: "#E0FFFF", minLevel: 50, bonus: { speed: 25, size: 20, collect: 20 } },
        { id: 7, name: "Rubi", shape: "square", color: "#DC143C", minLevel: 70, bonus: { speed: 30, size: 25, collect: 25 } },
        { id: 8, name: "Safira", shape: "square", color: "#4169E1", minLevel: 90, bonus: { speed: 35, size: 30, collect: 30 } },
        { id: 9, name: "Mítico", shape: "star", color: "#FFD700", minLevel: 120, bonus: { speed: 50, size: 40, collect: 50 } }
    ],

    getStage(level) {
        let currentStage = this.stages[0];
        for (const stage of this.stages) {
            if (level >= stage.minLevel) {
                currentStage = stage;
            } else {
                break;
            }
        }
        return currentStage;
    },

    getSpeedBonus(level) {
        return this.getStage(level).bonus.speed;
    },

    getSizeBonus(level) {
        return this.getStage(level).bonus.size;
    },

    getCollectBonus(level) {
        return this.getStage(level).bonus.collect;
    },

    drawShape(ctx, x, y, size, stage, isPlayer = true) {
        ctx.save();
        ctx.shadowBlur = isPlayer ? 15 : 5;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        
        ctx.fillStyle = stage.color;
        
        switch(stage.shape) {
            case "circle":
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case "square":
                ctx.fillRect(x - size, y - size, size * 2, size * 2);
                break;
            case "star":
                drawStar(ctx, x, y, size);
                break;
        }
        
        if (isPlayer && stage.id >= 8) {
            ctx.strokeStyle = "#FFD700";
            ctx.lineWidth = 3;
            if (stage.shape === "circle") {
                ctx.beginPath();
                ctx.arc(x, y, size + 3, 0, Math.PI * 2);
                ctx.stroke();
            } else if (stage.shape === "square") {
                ctx.strokeRect(x - size - 3, y - size - 3, (size + 3) * 2, (size + 3) * 2);
            }
        }
        
        ctx.restore();
    }
};

function drawStar(ctx, x, y, size) {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size / 2;
    let rotation = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
        const x1 = x + Math.cos(rotation) * outerRadius;
        const y1 = y + Math.sin(rotation) * outerRadius;
        ctx.lineTo(x1, y1);
        rotation += step;
        
        const x2 = x + Math.cos(rotation) * innerRadius;
        const y2 = y + Math.sin(rotation) * innerRadius;
        ctx.lineTo(x2, y2);
        rotation += step;
    }
    ctx.closePath();
    ctx.fill();
}