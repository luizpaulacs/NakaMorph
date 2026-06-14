export class CollisionSystem {
    constructor(player, onGameOver) {
        this.player = player;
        this.onGameOver = onGameOver;
    }

    checkFoodCollision(foodItems, addPointsCallback) {
        for (let i = 0; i < foodItems.length; i++) {
            const food = foodItems[i];
            const dx = this.player.data.x - food.x;
            const dy = this.player.data.y - food.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < this.player.data.size + 8) {
                addPointsCallback(food.value);
                foodItems.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    checkPlayerCollision(players, removePlayerCallback) {
        for (let id in players) {
            if (id === this.player.id) continue;
            const other = players[id];
            if (!other) continue;
            
            const dx = this.player.data.x - other.x;
            const dy = this.player.data.y - other.y;
            const distance = Math.hypot(dx, dy);
            
            if (distance < this.player.data.size + (other.size || 30)) {
                if (this.player.data.size > (other.size || 30) * 1.1) {
                    const pointsGained = Math.floor((other.score || 0) / 2);
                    this.player.addPoints(pointsGained);
                    removePlayerCallback(id);
                    return { collision: true, killed: true };
                } else if (this.player.data.size * 1.1 < (other.size || 30)) {
                    this.onGameOver();
                    return { collision: true, killed: false };
                }
            }
        }
        return { collision: false };
    }

    static generateFood(worldWidth, worldHeight, currentFood, maxFood = 150) {
        const foodItems = [...currentFood];
        while (foodItems.length < maxFood) {
            foodItems.push({
                x: Math.random() * worldWidth,
                y: Math.random() * worldHeight,
                value: 10 + Math.floor(Math.random() * 20)
            });
        }
        return foodItems;
    }
}