import { db, auth, signInAnonymously, ref, onValue, set } from './firebase-config.js';
import { Player } from './player.js';
import { CollisionSystem } from './collision.js';
import { Shop } from './shop.js';
import { World, MiniMap } from './world.js';
import { EvolutionSystem } from './evolution.js';

// Elementos do DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configurações do Mundo
const WORLD_WIDTH = 8000;   // 10x o canvas padrão (800)
const WORLD_HEIGHT = 6000;  // 10x o canvas padrão (600)

// Variáveis globais
let gameRunning = false;
let player = null;
let collisionSystem = null;
let shop = null;
let world = null;
let miniMap = null;
let players = {};
let foodItems = [];
let targetX = null, targetY = null;  // Posição alvo para movimento
let animationId = null;

// Configurações do Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 200;
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
}

window.addEventListener('resize', resizeCanvas);

// Movimento (Mouse/Touch) - Agora controla direção, não posição absoluta
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
    
    // Coordenadas do mouse na tela
    const screenX = (clientX - rect.left) * scaleX;
    const screenY = (clientY - rect.top) * scaleY;
    
    // Converter para coordenadas do mundo
    const worldX = screenX + world.camera.x;
    const worldY = screenY + world.camera.y;
    
    targetX = worldX;
    targetY = worldY;
}

canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('touchmove', handleMove);
canvas.addEventListener('touchstart', handleMove);

// Atualizar posição com movimento suave para o alvo
function updatePosition() {
    if (!gameRunning || !player || !world) return;
    
    // Se não tem alvo, usa posição atual
    if (targetX === null || targetY === null) {
        targetX = player.data.x;
        targetY = player.data.y;
    }
    
    // Calcular direção
    const dx = targetX - player.data.x;
    const dy = targetY - player.data.y;
    const distance = Math.hypot(dx, dy);
    
    // Velocidade base (diminui conforme cresce, aumenta com evolução)
    const speedBonus = EvolutionSystem.getSpeedBonus(player.data.level);
    let baseSpeed = 5;
    
    // Quanto maior, mais lento (mas evolução compensa)
    const sizePenalty = Math.max(0.5, 1 - (player.data.size / 300));
    let speed = baseSpeed * (1 + speedBonus / 100) * sizePenalty;
    speed = Math.min(12, Math.max(3, speed));  // Limitar velocidade
    
    if (distance > 5) {
        const moveX = (dx / distance) * speed;
        const moveY = (dy / distance) * speed;
        player.updatePosition(player.data.x + moveX, player.data.y + moveY, world);
    } else if (distance > 0) {
        player.updatePosition(targetX, targetY, world);
    }
    
    // Atualizar câmera para seguir o jogador
    world.updateCamera(player.data.x, player.data.y, canvas.width, canvas.height);
    
    player.saveToFirebase();
}

// Game Over
function gameOver() {
    gameRunning = false;
    const reviveBtn = document.getElementById('reviveAd');
    if (reviveBtn) reviveBtn.classList.remove('hidden');
    alert(`💀 Game Over! Pontuação final: ${Math.floor(player?.data?.score || 0)}`);
}

// Reviver com anúncio
function reviveWithAd() {
    alert('📺 Assistindo anúncio para reviver...');
    if (player && world) {
        const spawnPoint = world.clampPosition(world.width / 2, world.height / 2, player.data.size);
        player.updatePosition(spawnPoint.x, spawnPoint.y, world);
        targetX = spawnPoint.x;
        targetY = spawnPoint.y;
    }
    gameRunning = true;
    const reviveBtn = document.getElementById('reviveAd');
    if (reviveBtn) reviveBtn.classList.add('hidden');
}

// Desenhar grid de referência (opcional)
function drawGrid() {
    if (!ctx || !world) return;
    
    const gridSize = 500;
    const startX = Math.floor(world.camera.x / gridSize) * gridSize;
    const startY = Math.floor(world.camera.y / gridSize) * gridSize;
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    
    for (let x = startX; x < world.camera.x + canvas.width + gridSize; x += gridSize) {
        const screenX = world.worldToScreen(x, 0).x;
        if (screenX >= 0 && screenX <= canvas.width) {
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }
    }
    
    for (let y = startY; y < world.camera.y + canvas.height + gridSize; y += gridSize) {
        const screenY = world.worldToScreen(0, y).y;
        if (screenY >= 0 && screenY <= canvas.height) {
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        }
    }
}

// Desenhar o jogo (com câmera)
function draw() {
    if (!ctx || !canvas || !world) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fundo gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a472a');
    gradient.addColorStop(1, '#0d2818');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid (opcional)
    drawGrid();
    
    // Desenhar comida (apenas visível)
    foodItems.forEach(food => {
        if (world.isVisible(food.x, food.y, 10, canvas.width, canvas.height)) {
            const screen = world.worldToScreen(food.x, food.y);
            ctx.fillStyle = '#FFD700';
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFA500';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`+${food.value}`, screen.x - 15, screen.y - 12);
        }
    });
    
    // Desenhar outros jogadores (apenas visíveis)
    for (let id in players) {
        if (id === player?.id) continue;
        const p = players[id];
        if (!p || !p.x || !p.y) continue;
        
        if (world.isVisible(p.x, p.y, p.size || 30, canvas.width, canvas.height)) {
            const screen = world.worldToScreen(p.x, p.y);
            const stage = EvolutionSystem.getStage(p.level || 1);
            EvolutionSystem.drawShape(ctx, screen.x, screen.y, p.size || 30, stage, false);
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px Arial';
            ctx.shadowBlur = 2;
            ctx.fillText(`${stage.name} Lv.${p.level}`, screen.x - 30, screen.y - (p.size || 30) - 10);
            
            // Indicador de distância (opcional)
            if (player && player.data) {
                const distToPlayer = Math.hypot(p.x - player.data.x, p.y - player.data.y);
                if (distToPlayer < 200) {
                    ctx.fillStyle = '#FF4444';
                    ctx.font = 'bold 8px Arial';
                    ctx.fillText(`⚠️ ${Math.floor(distToPlayer)}`, screen.x - 20, screen.y - (p.size || 30) - 25);
                }
            }
        }
    }
    
    // Desenhar player (sempre visível)
    if (player && player.data) {
        const screen = world.worldToScreen(player.data.x, player.data.y);
        const stage = player.getEvolutionStage();
        EvolutionSystem.drawShape(ctx, screen.x, screen.y, player.data.size, stage, true);
        
        // Efeito de boost
        if (player.data.boost) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.shadowBlur = 10;
            if (stage.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, player.data.size + 5, 0, Math.PI * 2);
                ctx.stroke();
            } else if (stage.shape === 'square') {
                ctx.strokeRect(screen.x - player.data.size - 5, screen.y - player.data.size - 5, 
                              (player.data.size + 5) * 2, (player.data.size + 5) * 2);
            }
        }
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.shadowBlur = 3;
        ctx.fillText(`${stage.name} Lv.${player.data.level}`, screen.x - 40, screen.y - player.data.size - 15);
        ctx.font = 'bold 11px Arial';
        ctx.fillText(`👤 Você`, screen.x - 25, screen.y - player.data.size - 30);
    }
    
    // Desenhar minimapa
    if (miniMap) {
        miniMap.draw(ctx, players, player);
    }
    
    ctx.shadowBlur = 0;
    
    // Indicador de borda do mundo (se estiver próximo)
    if (player && world) {
        const margin = 100;
        if (player.data.x < margin || player.data.x > world.width - margin ||
            player.data.y < margin || player.data.y > world.height - margin) {
            ctx.fillStyle = 'rgba(255,0,0,0.7)';
            ctx.font = 'bold 14px Arial';
            ctx.fillText("⚠️ LIMITE DO MUNDO ⚠️", canvas.width / 2 - 100, 50);
        }
    }
}

// Loop principal do jogo
function gameLoop() {
    if (!gameRunning || !player || !collisionSystem || !world) {
        draw();
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }
    
    updatePosition();
    
    // Verificar colisões com comida
    collisionSystem.checkFoodCollision(foodItems, (points) => {
        player.addPoints(points);
    });
    
    // Verificar colisões com outros jogadores
    collisionSystem.checkPlayerCollision(players, async (id) => {
        await set(ref(db, `players/${id}`), null);
    });
    
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
}

// Inicializar Firebase Realtime
function initFirebase(playerId) {
    const playersRef = ref(db, 'players');
    onValue(playersRef, (snapshot) => {
        players = snapshot.val() || {};
    }, (error) => {
        console.error('Erro ao conectar ao Firebase:', error);
    });
}

// Iniciar jogo
async function startGame() {
    try {
        const playBtn = document.getElementById('playAnonymously');
        if (playBtn) {
            playBtn.textContent = '⏳ Conectando...';
            playBtn.disabled = true;
        }
        
        // Login anônimo
        const userCredential = await signInAnonymously(auth);
        const playerId = userCredential.user.uid;
        
        console.log('Conectado com ID:', playerId);
        
        // Inicializar mundo gigante
        world = new World(WORLD_WIDTH, WORLD_HEIGHT);
        miniMap = new MiniMap(world, canvas);
        
        // Inicializar player
        player = new Player(playerId, canvas);
        
        // Spawn em posição aleatória do mundo
        const spawnX = Math.random() * (WORLD_WIDTH - 200) + 100;
        const spawnY = Math.random() * (WORLD_HEIGHT - 200) + 100;
        player.updatePosition(spawnX, spawnY, world);
        
        player.setupDisconnect();
        await player.saveToFirebase();
        
        // Inicializar sistemas
        collisionSystem = new CollisionSystem(player, gameOver);
        shop = new Shop(player);
        
        initFirebase(playerId);
        
        // Gerar comida pelo mundo
        foodItems = world.generateFood(200);
        
        gameRunning = true;
        
        // Alternar telas
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        // Iniciar loop
        if (animationId) cancelAnimationFrame(animationId);
        gameLoop();
        
        // Dar gemas iniciais
        player.addGems(20);
        
    } catch (error) {
        console.error('Erro detalhado ao iniciar:', error);
        
        let errorMessage = 'Erro ao conectar: ';
        if (error.code === 'auth/operation-not-allowed') {
            errorMessage += 'Autenticação anônima não está ativada no Firebase Console.';
        } else if (error.code === 'permission-denied') {
            errorMessage += 'Permissão negada. Verifique as regras do Firebase.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage + '\n\nVerifique o console (F12) para mais detalhes.');
        
        const playBtn = document.getElementById('playAnonymously');
        if (playBtn) {
            playBtn.textContent = '🎮 Jogar Agora';
            playBtn.disabled = false;
        }
    }
}

// Event Listeners
document.getElementById('playAnonymously').addEventListener('click', startGame);
document.getElementById('reviveAd').addEventListener('click', reviveWithAd);
document.getElementById('openShop').addEventListener('click', () => {
    document.getElementById('gameScreen').classList.remove('active');
    document.getElementById('shopScreen').classList.add('active');
});
document.getElementById('closeShop').addEventListener('click', () => {
    document.getElementById('shopScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
});

// Resize inicial
resizeCanvas();
