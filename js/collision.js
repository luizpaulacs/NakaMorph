export class CollisionSystem {
    constructor(player, onGameOver) {
        this.player = player;
        this.onGameOver = onGameOver;
    }

    // Verificar colisão com comida
    checkFoodCollision(foodItems, addPointsCallback) {
        for (let i = 0; i < foodItems.length; i++) {
            const food = foodItems[i];
            const dx = this.player.data.x - food.x;
            const dy = this.player.data.y - food.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < this.player.data.size + 5) {
                addPointsCallback(food.value);
                foodItems.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    // Verificar colisão com outros jogadores
    checkPlayerCollision(players, removePlayerCallback) {
        for (let id in players) {
            if (id === this.player.id) continue;
            
            const other = players[id];
            if (!other) continue;
            
            const dx = this.player.data.x - other.x;
            const dy = this.player.data.y - other.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < this.player.data.size + other.size) {
                if (this.player.data.size > other.size * 1.1) { // 10% maior para comer
                    // Player maior: come o outro
                    const pointsGained = Math.floor(other.score / 2);
                    this.player.addPoints(pointsGained);
                    removePlayerCallback(id);
                    return { collision: true, killed: true };
                } else if (this.player.data.size * 1.1 < other.size) {
                    // Player menor: morre
                    this.onGameOver();
                    return { collision: true, killed: false };
                }
            }
        }
        return { collision: false };
    }

    // Gerar nova comida
    static generateFood(canvas, currentFood, maxFood = 30) {
        const foodItems = [...currentFood];
        while (foodItems.length < maxFood) {
            foodItems.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                value: 10 + Math.floor(Math.random() * 20) // 10-30 pontos
            });
        }
        return foodItems;
    }
}