import { db, ref, set, onDisconnect } from './firebase-config.js';

export class Player {
    constructor(id, canvas) {
        this.id = id;
        this.canvas = canvas;
        this.data = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            size: 30,
            score: 0,
            level: 1,
            gems: 0,
            skin: 'default',
            boost: false,
            boostEndTime: 0
        };
    }

    // Calcular nível baseado nos pontos
    calculateLevel(score) {
        return Math.floor(score / 100) + 1;
    }

    // Calcular tamanho baseado no nível
    calculateSize(level) {
        return 30 + (level - 1) * 5;
    }

    // Adicionar pontos
    addPoints(points) {
        let multiplier = this.data.boost ? 2 : 1;
        let gained = points * multiplier;
        this.data.score += gained;
        this.data.level = this.calculateLevel(this.data.score);
        this.data.size = this.calculateSize(this.data.level);
        
        // Atualizar UI
        document.getElementById('level').textContent = this.data.level;
        document.getElementById('score').textContent = Math.floor(this.data.score);
        document.getElementById('size').textContent = Math.floor(this.data.size);
        
        return gained;
    }

    // Adicionar gemas
    addGems(amount) {
        this.data.gems += amount;
        document.getElementById('gems').textContent = this.data.gems;
        this.saveToFirebase();
    }

    // Remover gemas
    removeGems(amount) {
        if (this.data.gems >= amount) {
            this.data.gems -= amount;
            document.getElementById('gems').textContent = this.data.gems;
            this.saveToFirebase();
            return true;
        }
        return false;
    }

    // Ativar boost
    activateBoost(durationSeconds = 1800) { // 30 minutos padrão
        this.data.boost = true;
        this.data.boostEndTime = Date.now() + (durationSeconds * 1000);
        
        // Desativar boost após o tempo
        setTimeout(() => {
            this.data.boost = false;
        }, durationSeconds * 1000);
    }

    // Salvar no Firebase
    async saveToFirebase() {
        await set(ref(db, `players/${this.id}`), {
            x: this.data.x,
            y: this.data.y,
            size: this.data.size,
            score: this.data.score,
            level: this.data.level,
            gems: this.data.gems,
            skin: this.data.skin,
            boost: this.data.boost,
            lastUpdate: Date.now()
        });
    }

    // Configurar remoção ao desconectar
    setupDisconnect() {
        onDisconnect(ref(db, `players/${this.id}`)).remove();
    }

    // Atualizar posição
    updatePosition(x, y) {
        this.data.x = Math.max(this.data.size, Math.min(this.canvas.width - this.data.size, x));
        this.data.y = Math.max(this.data.size, Math.min(this.canvas.height - this.data.size, y));
    }

    // Aplicar skin
    setSkin(skinId) {
        this.data.skin = skinId;
        this.saveToFirebase();
    }
}