import { db, ref, update, get } from './firebase-config.js';

export class Shop {
    constructor(player) {
        this.player = player;
        this.items = {
            skins: {
                dragon: { price: 50, emoji: '🐉', name: 'Skin Dragão' },
                phoenix: { price: 100, emoji: '🔥', name: 'Skin Fênix' }
            },
            boosts: {
                double: { type: 'boost', duration: 1800, name: 'Dobro de Pontos' }
            }
        };
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Comprar com gemas
        document.querySelectorAll('.buy-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.shop-item');
                const type = item.dataset.type;
                const id = item.dataset.id;
                
                if (type === 'skin') {
                    await this.buySkin(id);
                }
            });
        });

        // Comprar com anúncio
        document.querySelectorAll('.buy-item-ad').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.shop-item');
                const id = item.dataset.id;
                
                // Simular anúncio
                this.showAd(() => {
                    this.purchaseWithAd(id);
                });
            });
        });
    }

    async buySkin(skinId) {
        const skin = this.items.skins[skinId];
        if (!skin) return;
        
        if (this.player.removeGems(skin.price)) {
            this.player.setSkin(skinId);
            alert(`🎉 Você adquiriu ${skin.name}!`);
            
            // Salvar skin no Firebase
            await update(ref(db, `players/${this.player.id}`), {
                skin: skinId
            });
        } else {
            alert(`❌ Gemas insuficientes! Você precisa de ${skin.price} gemas.`);
        }
    }

    purchaseWithAd(itemId) {
        if (itemId === 'double') {
            this.player.activateBoost(1800);
            alert('⚡ Boost ativado! Você ganha DOBRO de pontos por 30 minutos!');
        }
    }

    showAd(onComplete) {
        // Simulação de anúncio (substituir por Google AdMob depois)
        const adWindow = document.createElement('div');
        adWindow.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 1000;
            box-shadow: 0 0 100px rgba(0,0,0,0.5);
        `;
        adWindow.innerHTML = `
            <h3>📺 Anúncio</h3>
            <p>Assistindo vídeo...</p>
            <div class="ad-timer">3</div>
            <button class="skip-ad" style="margin-top:10px;">Pular (Recompensa menor)</button>
        `;
        document.body.appendChild(adWindow);
        
        let timeLeft = 3;
        const timer = setInterval(() => {
            timeLeft--;
            const timerDiv = adWindow.querySelector('.ad-timer');
            if (timerDiv) timerDiv.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                adWindow.remove();
                onComplete();
                alert('✅ Recompensa concedida!');
            }
        }, 1000);
        
        // Botão pular (recompensa parcial)
        adWindow.querySelector('.skip-ad').onclick = () => {
            clearInterval(timer);
            adWindow.remove();
            alert('⚠️ Você pulou o anúncio! Recompensa reduzida.');
            // Dar apenas 50% do boost
            setTimeout(() => onComplete(), 100);
        };
    }
}