import { db, ref, set, onDisconnect } from './firebase-config.js';
import { EvolutionSystem } from './evolution.js';

export class Player {
    constructor(id, canvas) {
        this.id = id;
        this.canvas = canvas;
        this.data = {
            x: 2000,
            y: 2000,
            size: 30,
            score: 0,
            level: 1,
            gems: 0,
            skin: 'default',
            boost: false,
            boostEndTime: 0
        };
    }

    calculateLevel(score) {
        return Math.max(1, Math.floor(Math.sqrt(score / 10)));
    }

    calculateSize(level) {
        const baseSize = Math.min(80, Math.floor(25 + Math.log(level) * 10));
        const bonus = EvolutionSystem.getSizeBonus(level);
        return Math.min(100, baseSize + Math.floor(bonus / 5));
    }

    addPoints(points) {
        let multiplier = this.data.boost ? 2 : 1;
        const collectBonus = EvolutionSystem.getCollectBonus(this.data.level);
        multiplier += collectBonus / 100;
        
        let gained = points * multiplier;
        this.data.score += gained;
        
        const oldLevel = this.data.level;
        const newLevel = this.calculateLevel(this.data.score);
        
        if (newLevel > oldLevel) {
            const gemsReward = Math.floor((newLevel - oldLevel) * 2);
            this.data.gems += gemsReward;
            this.updateUI();
        }
        
        this.data.level = newLevel;
        this.data.size = this.calculateSize(this.data.level);
        this.updateUI();
        
        return gained;
    }

    updateUI() {
        const levelEl = document.getElementById('level');
        const scoreEl = document.getElementById('score');
        const sizeEl = document.getElementById('size');
        const gemsEl = document.getElementById('gems');
        const evolutionEl = document.getElementById('evolution-title');
        
        if (levelEl) levelEl.textContent = this.data.level;
        if (scoreEl) scoreEl.textContent = Math.floor(this.data.score);
        if (sizeEl) sizeEl.textContent = Math.floor(this.data.size);
        if (gemsEl) gemsEl.textContent = this.data.gems;
        if (evolutionEl) evolutionEl.textContent = EvolutionSystem.getStage(this.data.level).name;
    }

    addGems(amount) {
        this.data.gems += amount;
        this.updateUI();
        this.saveToFirebase();
    }

    removeGems(amount) {
        if (this.data.gems >= amount) {
            this.data.gems -= amount;
            this.updateUI();
            this.saveToFirebase();
            return true;
        }
        return false;
    }

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

    setupDisconnect() {
        onDisconnect(ref(db, `players/${this.id}`)).remove();
    }

    updatePosition(x, y, worldWidth, worldHeight) {
        this.data.x = Math.max(this.data.size, Math.min(worldWidth - this.data.size, x));
        this.data.y = Math.max(this.data.size, Math.min(worldHeight - this.data.size, y));
    }
}