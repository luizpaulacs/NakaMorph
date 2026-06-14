import { db, auth, signInAnonymously, onAuthStateChanged, ref, onValue, set } from './firebase-config.js';
import { Player } from './player.js';
import { CollisionSystem } from './collision.js';
import { Shop } from './shop.js';

// Elementos do DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Variáveis globais
let gameRunning = false;
let player = null;
let collisionSystem = null;
let shop = null;
let players = {};
let foodItems = [];
let mouseX = 400, mouseY = 300;
let animationId = null;

// Configurações do Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 200;
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
}

window.addEventListener('resize', resizeCanvas);

// Movimento (Mouse/Touch)
function handleMove(e) {
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
    
    mouseX = (clientX - rect.left) * scaleX;
    mouseY = (clientY - rect.top) * scaleY;
    
    // Limitar ao canvas
    mouseX = Math.max(30, Math.min(canvas.width - 30, mouseX));
    mouseY = Math.max(30, Math.min(canvas.height - 30, mouseY));
}

canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('touchmove', handleMove);
canvas.addEventListener('touchstart', handleMove);

// Atualizar posição no Firebase
function updatePosition() {
    if (!gameRunning || !player) return;
    
    // Movimento suave em direção ao mouse
    const dx = mouseX - player.data.x;
    const dy = mouseY - player.data.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance > 5) {
        const speed = Math.min(8, distance / 10);
        const newX = player.data.x + (dx / distance) * speed;
        const newY = player.data.y + (dy / distance) * speed;
        player.updatePosition(newX, newY);
    }
    
    player.saveToFirebase();
}

// Game Over
function gameOver() {
    gameRunning = false;
    document.getElementById('reviveAd').classList.remove('hidden');
    
    // Salvar pontuação final
    alert(`💀 Game Over! Pontuação final: ${Math.floor(player.data.score)}`);
}

// Reviver com anúncio
function reviveWithAd() {
    // Simular anúncio
    alert('📺 Assistindo anúncio para reviver...');
    
    // Resetar posição
    player.updatePosition(canvas.width / 2, canvas.height / 2);
    gameRunning = true;
    document.getElementById('reviveAd').classList.add('hidden');
}

// Desenhar o jogo
function draw() {
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar comida
    foodItems.forEach(food => {
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(food.x, food.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFA500';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(`+${food.value}`, food.x - 12, food.y - 8);
    });
    
    // Desenhar outros jogadores
    for (let id in players) {
        if (id === player?.id) continue;
        const p = players[id];
        if (!p) continue;
        
        // Gradiente para outros jogadores
        const gradient = ctx.createRadialGradient(p.x - 10, p.y - 10, 5, p.x, p.y, p.size);
        gradient.addColorStop(0, '#FF4444');
        gradient.addColorStop(1, '#CC0000');
        ctx.fillStyle = gradient;
        
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.shadowBlur = 2;
        ctx.fillText(`Lv.${p.level}`, p.x - 20, p.y - p.size - 5);
        ctx.fillText(`⭐${Math.floor(p.score)}`, p.x - 20, p.y - p.size - 20);
    }
    
    // Desenhar player
    if (player) {
        let gradient;
        if (player.data.skin === 'dragon') {
            gradient = ctx.createRadialGradient(player.data.x - 10, player.data.y - 10, 5, player.data.x, player.data.y, player.data.size);
            gradient.addColorStop(0, '#44FF44');
            gradient.addColorStop(1, '#00AA00');
        } else if (player.data.skin === 'phoenix') {
            gradient = ctx.createRadialGradient(player.data.x - 10, player.data.y - 10, 5, player.data.x, player.data.y, player.data.size);
            gradient.addColorStop(0, '#FF6600');
            gradient.addColorStop(1, '#FF3300');
        } else {
            gradient = ctx.createRadialGradient(player.data.x - 10, player.data.y - 10, 5, player.data.x, player.data.y, player.data.size);
            gradient.addColorStop(0, '#44AAFF');
            gradient.addColorStop(1, '#0066CC');
        }
        
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(player.data.x, player.data.y, player.data.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Efeito de boost
        if (player.data.boost) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(player.data.x, player.data.y, player.data.size + 5, 0, Math.PI * 2);
            ctx.stroke();
            
            // Partículas de boost
            for (let i = 0; i < 5; i++) {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(player.data.x + (Math.random() - 0.5) * player.data.size, 
                       player.data.y + (Math.random() - 0.5) * player.data.size, 
                       3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.shadowBlur = 3;
        ctx.fillText(`Lv.${player.data.level}`, player.data.x - 20, player.data.y - player.data.size - 10);
        ctx.font = 'bold 12px Arial';
        ctx.fillText(`👤 Você`, player.data.x - 25, player.data.y - player.data.size - 25);
    }
    
    ctx.shadowBlur = 0;
}

// Loop principal do jogo
function gameLoop() {
    if (!gameRunning || !player || !collisionSystem) {
        draw();
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }
    
    updatePosition();
    
    // Recarregar comida
    foodItems = CollisionSystem.generateFood(canvas, foodItems, 30);
    
    // Verificar colisões
    collisionSystem.checkFoodCollision(foodItems, (points) => {
        player.addPoints(points);
    });
    
    const collisionResult = collisionSystem.checkPlayerCollision(players, async (id) => {
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
    });
}

// Iniciar jogo
async function startGame() {
    try {
        // Login anônimo
        const userCredential = await signInAnonymously(auth);
        const playerId = userCredential.user.uid;
        
        // Inicializar player
        player = new Player(playerId, canvas);
        player.setupDisconnect();
        await player.saveToFirebase();
        
        // Inicializar sistemas
        collisionSystem = new CollisionSystem(player, gameOver);
        shop = new Shop(player);
        
        initFirebase(playerId);
        gameRunning = true;
        
        // Alternar telas
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        
        // Iniciar loop
        if (animationId) cancelAnimationFrame(animationId);
        gameLoop();
        
        // Dar gemas iniciais (teste)
        player.addGems(20);
        
    } catch (error) {
        console.error('Erro ao iniciar:', error);
        alert('Erro ao conectar ao servidor. Tente novamente.');
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

// Gerar comida inicial
for (let i = 0; i < 30; i++) {
    foodItems.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        value: 10 + Math.floor(Math.random() * 20)
    });
}