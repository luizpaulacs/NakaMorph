import { db, auth, signInAnonymously, ref, onValue, set } from './firebase-config.js';
import { Player } from './player.js';
import { CollisionSystem } from './collision.js';
import { EvolutionSystem } from './evolution.js';

// Elementos do DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configurações do Mundo
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

// Variáveis globais
let gameRunning = false;
let player = null;
let collisionSystem = null;
let players = {};
let foodItems = [];
let targetX = null;
let targetY = null;
let animationId = null;
let camera = { x: 0, y: 0 };

// Configurações do Canvas
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 200;
}
window.addEventListener('resize', resizeCanvas);

// Movimento
function handleMove(e) {
    if (!canvas || !player) return;
    
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

// Converter mundo para tela
function worldToScreen(worldX, worldY) {
    return { x: worldX - camera.x, y: worldY - camera.y };
}

// Verificar se está visível
function isVisible(worldX, worldY, size) {
    if (!canvas) return false;
    const screen = worldToScreen(worldX, worldY);
    return (screen.x + size > 0 && screen.x - size < canvas.width &&
            screen.y + size > 0 && screen.y - size < canvas.height);
}

// Atualizar posição do jogador
function updatePosition() {
    if (!gameRunning || !player) return;
    
    if (targetX === null || targetY === null) {
        targetX = player.data.x;
        targetY = player.data.y;
    }
    
    const dx = targetX - player.data.x;
    const dy = targetY - player.data.y;
    const distance = Math.hypot(dx, dy);
    
    let speed = 5;
    if (distance > 5) {
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;
        
        let newX = player.data.x + moveX;
        let newY = player.data.y + moveY;
        
        // Limites do mundo
        newX = Math.max(30, Math.min(WORLD_WIDTH - 30, newX));
        newY = Math.max(30, Math.min(WORLD_HEIGHT - 30, newY));
        
        player.data.x = newX;
        player.data.y = newY;
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

// Reviver
function reviveWithAd() {
    if (!player || !canvas) return;
    alert('📺 Revivendo com anúncio...');
    player.data.x = WORLD_WIDTH / 2;
    player.data.y = WORLD_HEIGHT / 2;
    targetX = player.data.x;
    targetY = player.data.y;
    gameRunning = true;
    const reviveBtn = document.getElementById('reviveAd');
    if (reviveBtn) reviveBtn.classList.add('hidden');
}

// Gerar comida
function generateFood() {
    while (foodItems.length < 100) {
        foodItems.push({
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT,
            value: 10 + Math.floor(Math.random() * 20)
        });
    }
}

// Verificar colisão com comida
function checkFoodCollision() {
    if (!player) return;
    
    for (let i = 0; i < foodItems.length; i++) {
        const food = foodItems[i];
        const dx = player.data.x - food.x;
        const dy = player.data.y - food.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance < player.data.size + 8) {
            player.addPoints(food.value);
            foodItems.splice(i, 1);
            break;
        }
    }
}

// Verificar colisão com outros jogadores
function checkPlayerCollision() {
    if (!player) return true;
    
    for (let id in players) {
        if (id === player.id) continue;
        const other = players[id];
        if (!other) continue;
        
        const dx = player.data.x - other.x;
        const dy = player.data.y - other.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance < player.data.size + (other.size || 30)) {
            if (player.data.size > (other.size || 30)) {
                player.addPoints(Math.floor((other.score || 0) / 2));
                set(ref(db, `players/${id}`), null);
            } else if (player.data.size < (other.size || 30)) {
                gameOver();
                return false;
            }
        }
    }
    return true;
}

// Desenhar
function draw() {
    if (!ctx || !canvas || !player) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fundo
    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Comida
    foodItems.forEach(food => {
        if (isVisible(food.x, food.y, 10)) {
            const screen = worldToScreen(food.x, food.y);
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFA500';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(`+${food.value}`, screen.x - 12, screen.y - 8);
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
            ctx.fillText(`Lv.${p.level}`, screen.x - 15, screen.y - (p.size || 30) - 5);
        }
    }
    
    // Player
    const screen = worldToScreen(player.data.x, player.data.y);
    const stage = EvolutionSystem.getStage(player.data.level);
    EvolutionSystem.drawShape(ctx, screen.x, screen.y, player.data.size, stage, true);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Lv.${player.data.level}`, screen.x - 15, screen.y - player.data.size - 10);
    
    // Minimapa
    drawMinimap();
}

// Minimapa
function drawMinimap() {
    if (!ctx || !canvas) return;
    
    const mapSize = 120;
    const mapX = canvas.width - mapSize - 10;
    const mapY = 10;
    
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);
    
    const scaleX = mapSize / WORLD_WIDTH;
    const scaleY = mapSize / WORLD_HEIGHT;
    
    // Outros jogadores
    for (let id in players) {
        if (id === player?.id) continue;
        const p = players[id];
        if (p) {
            ctx.fillStyle = '#FF4444';
            ctx.beginPath();
            ctx.arc(mapX + p.x * scaleX, mapY + p.y * scaleY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Player
    if (player) {
        ctx.fillStyle = '#44FF44';
        ctx.beginPath();
        ctx.arc(mapX + player.data.x * scaleX, mapY + player.data.y * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Loop principal
function gameLoop() {
    if (!gameRunning || !player) {
        draw();
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }
    
    updatePosition();
    generateFood();
    checkFoodCollision();
    
    if (!checkPlayerCollision()) {
        draw();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

// Iniciar jogo
async function startGame() {
    try {
        console.log('Iniciando jogo...');
        
        const playBtn = document.getElementById('playAnonymously');
        if (playBtn) {
            playBtn.textContent = '⏳ Conectando...';
            playBtn.disabled = true;
        }
        
        const userCredential = await signInAnonymously(auth);
        const playerId = userCredential.user.uid;
        console.log('Conectado:', playerId);
        
        // Inicializar player
        player = new Player(playerId, canvas);
        player.data.x = WORLD_WIDTH / 2;
        player.data.y = WORLD_HEIGHT / 2;
        player.data.size = 30;
        await player.saveToFirebase();
        
        collisionSystem = new CollisionSystem(player, gameOver);
        
        // Ouvir outros jogadores
        const playersRef = ref(db, 'players');
        onValue(playersRef, (snapshot) => {
            players = snapshot.val() || {};
        });
        
        // Remover ao desconectar
        if (player.id) {
            const playerRef = ref(db, `players/${player.id}`);
            onValue(playerRef, (snapshot) => {
                if (!snapshot.exists()) {
                    console.log('Jogador removido');
                }
            });
        }
        
        generateFood();
        gameRunning = true;
        
        // Alternar telas
        const loginScreen = document.getElementById('loginScreen');
        const gameScreen = document.getElementById('gameScreen');
        if (loginScreen) loginScreen.classList.remove('active');
        if (gameScreen) gameScreen.classList.add('active');
        
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
const playBtn = document.getElementById('playAnonymously');
if (playBtn) playBtn.addEventListener('click', startGame);

const reviveBtn = document.getElementById('reviveAd');
if (reviveBtn) reviveBtn.addEventListener('click', reviveWithAd);

const openShopBtn = document.getElementById('openShop');
if (openShopBtn) {
    openShopBtn.addEventListener('click', () => {
        const gameScreen = document.getElementById('gameScreen');
        const shopScreen = document.getElementById('shopScreen');
        if (gameScreen) gameScreen.classList.remove('active');
        if (shopScreen) shopScreen.classList.add('active');
    });
}

const closeShopBtn = document.getElementById('closeShop');
if (closeShopBtn) {
    closeShopBtn.addEventListener('click', () => {
        const gameScreen = document.getElementById('gameScreen');
        const shopScreen = document.getElementById('shopScreen');
        if (shopScreen) shopScreen.classList.remove('active');
        if (gameScreen) gameScreen.classList.add('active');
    });
}

resizeCanvas();
console.log('Game.js carregado com sucesso!');
