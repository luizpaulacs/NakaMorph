import { db, auth, signInAnonymously, ref, onValue, set, remove } from './firebase-config.js';
import { Player } from './player.js';
import { CollisionSystem } from './collision.js';
import { Shop } from './shop.js';
import { EvolutionSystem } from './evolution.js';

// Configurações
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

// Elementos DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Variáveis
let gameRunning = false;
let player = null;
let players = {};
let foodItems = [];
let targetX = null, targetY = null;
let animationId = null;
let camera = { x: 0, y: 0 };

// Configurar canvas
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 200;
}
window.addEventListener('resize', resizeCanvas);

// Movimento
function handleMove(e) {
    if (!canvas || !player || !gameRunning) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        e.preventDefault();
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    const screenX = (clientX - rect.left) * scaleX;
    const screenY = (clientY - rect.top) * scaleY;
    
    targetX = screenX + camera.x;
    targetY = screenY + camera.y;
    
    // Limitar ao mundo
    targetX = Math.max(50, Math.min(WORLD_WIDTH - 50, targetX));
    targetY = Math.max(50, Math.min(WORLD_HEIGHT - 50, targetY));
}

if (canvas) {
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('touchmove', handleMove);
    canvas.addEventListener('touchstart', handleMove);
}

// Atualizar câmera
function updateCamera() {
    if (!player || !canvas) return;
    camera.x = player.data.x - canvas.width / 2;
    camera.y = player.data.y - canvas.height / 2;
    
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, camera.y));
}

// Converter coordenadas
function worldToScreen(worldX, worldY) {
    return { x: worldX - camera.x, y: worldY - camera.y };
}

function isVisible(worldX, worldY, size) {
    if (!canvas) return false;
    const screen = worldToScreen(worldX, worldY);
    return (screen.x + size > 0 && screen.x - size < canvas.width &&
            screen.y + size > 0 && screen.y - size < canvas.height);
}

// Movimento do jogador
function updatePosition() {
    if (!gameRunning || !player) return;
    
    if (targetX === null || targetY === null) {
        targetX = player.data.x;
        targetY = player.data.y;
    }
    
    const dx = targetX - player.data.x;
    const dy = targetY - player.data.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance > 5) {
        const speedBonus = EvolutionSystem.getSpeedBonus(player.data.level);
        let speed = 5 * (1 + speedBonus / 100);
        speed = Math.min(10, Math.max(3, speed));
        
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;
        
        player.updatePosition(player.data.x + moveX, player.data.y + moveY, WORLD_WIDTH, WORLD_HEIGHT);
    }
    
    updateCamera();
    player.saveToFirebase();
}

// Game Over
function gameOver() {
    gameRunning = false;
    const reviveBtn = document.getElementById('reviveAd');
    if (reviveBtn) reviveBtn.classList.remove('hidden');
}

function reviveWithAd() {
    if (!player) return;
    alert('📺 Revivendo com anúncio...');
    player.data.x = WORLD_WIDTH / 2;
    player.data.y = WORLD_HEIGHT / 2;
    targetX = player.data.x;
    targetY = player.data.y;
    gameRunning = true;
    const reviveBtn = document.getElementById('reviveAd');
    if (reviveBtn) reviveBtn.classList.add('hidden');
}

// Desenhar
function draw() {
    if (!ctx || !canvas || !player) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fundo gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a472a');
    gradient.addColorStop(1, '#0d2818');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Comida
    foodItems.forEach(food => {
        if (isVisible(food.x, food.y, 10)) {
            const screen = worldToScreen(food.x, food.y);
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFA500';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(`+${food.value}`, screen.x - 12, screen.y - 10);
        }
    });
    
    // Outros jogadores
    for (let id in players) {
        if (id === player.id) continue;
        const p = players[id];
        if (!p || !p.x || !p.y) continue;
        
        if (isVisible(p.x, p.y, p.size || 30)) {
            const screen = worldToScreen(p.x, p.y);
            const stage = EvolutionSystem.getStage(p.level || 1);
            EvolutionSystem.drawShape(ctx, screen.x, screen.y, p.size || 30, stage, false);
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(`Lv.${p.level}`, screen.x - 20, screen.y - (p.size || 30) - 5);
        }
    }
    
    // Player
    const screen = worldToScreen(player.data.x, player.data.y);
    const stage = EvolutionSystem.getStage(player.data.level);
    EvolutionSystem.drawShape(ctx, screen.x, screen.y, player.data.size, stage, true);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${stage.name} Lv.${player.data.level}`, screen.x - 35, screen.y - player.data.size - 10);
    
    // Minimapa
    drawMinimap();
}

// Minimapa
function drawMinimap() {
    if (!ctx || !canvas) return;
    
    const mapSize = 120;
    const mapX = canvas.width - mapSize - 10;
    const mapY = 10;
    
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);
    
    const scaleX = mapSize / WORLD_WIDTH;
    const scaleY = mapSize / WORLD_HEIGHT;
    
    // Outros jogadores
    for (let id in players) {
        if (id === player?.id) continue;
        const p = players[id];
        if (p && p.x && p.y) {
            ctx.fillStyle = '#FF6666';
            ctx.beginPath();
            ctx.arc(mapX + p.x * scaleX, mapY + p.y * scaleY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Player
    if (player) {
        ctx.fillStyle = '#44FF44';
        ctx.beginPath();
        ctx.arc(mapX + player.data.x * scaleX, mapY + player.data.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Viewport
    if (canvas) {
        const viewX = mapX + camera.x * scaleX;
        const viewY = mapY + camera.y * scaleY;
        const viewW = (canvas.width / WORLD_WIDTH) * mapSize;
        const viewH = (canvas.height / WORLD_HEIGHT) * mapSize;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(viewX, viewY, viewW, viewH);
    }
}

// Loop principal
function gameLoop() {
    if (!gameRunning || !player) {
        if (animationId) cancelAnimationFrame(animationId);
        return;
    }
    
    updatePosition();
    
    // Gerar comida
    foodItems = CollisionSystem.generateFood(WORLD_WIDTH, WORLD_HEIGHT, foodItems, 150);
    
    // Colisões
    const collisionSystem = new CollisionSystem(player, gameOver);
    collisionSystem.checkFoodCollision(foodItems, (points) => {
        player.addPoints(points);
    });
    
    collisionSystem.checkPlayerCollision(players, async (id) => {
        await remove(ref(db, `players/${id}`));
    });
    
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

// Iniciar jogo
async function startGame() {
    try {
        console.log('Iniciando NakaMorph...');
        
        const playBtn = document.getElementById('playAnonymously');
        if (playBtn) {
            playBtn.textContent = '⏳ Conectando...';
            playBtn.disabled = true;
        }
        
        const userCredential = await signInAnonymously(auth);
        const playerId = userCredential.user.uid;
        console.log('Conectado:', playerId);
        
        player = new Player(playerId, canvas);
        player.data.x = WORLD_WIDTH / 2;
        player.data.y = WORLD_HEIGHT / 2;
        player.data.size = 30;
        await player.saveToFirebase();
        player.setupDisconnect();
        
        // Ouvir outros jogadores
        const playersRef = ref(db, 'players');
        onValue(playersRef, (snapshot) => {
            players = snapshot.val() || {};
        });
        
        // Gerar comida inicial
        foodItems = CollisionSystem.generateFood(WORLD_WIDTH, WORLD_HEIGHT, [], 150);
        
        gameRunning = true;
        
        // Alternar telas
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        resizeCanvas();
        updateCamera();
        
        if (animationId) cancelAnimationFrame(animationId);
        gameLoop();
        
        player.addGems(20);
        
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao iniciar: ' + error.message);
        
        const playBtn = document.getElementById('playAnonymously');
        if (playBtn) {
            playBtn.textContent = '🎮 Jogar Agora';
            playBtn.disabled = false;
        }
    }
}

// Event Listeners
document.getElementById('playAnonymously')?.addEventListener('click', startGame);
document.getElementById('reviveAd')?.addEventListener('click', reviveWithAd);
document.getElementById('openShop')?.addEventListener('click', () => {
    document.getElementById('gameScreen')?.classList.remove('active');
    document.getElementById('shopScreen')?.classList.add('active');
});
document.getElementById('closeShop')?.addEventListener('click', () => {
    document.getElementById('shopScreen')?.classList.remove('active');
    document.getElementById('gameScreen')?.classList.add('active');
});

resizeCanvas();
console.log('Game.js carregado!');