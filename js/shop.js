import { ref, update } from './firebase-config.js';

export class Shop {
    constructor(player) {
        this.player = player;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.querySelectorAll('.buy-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = e.target.closest('.shop-item');
                const type = item?.dataset.type;
                const id = item?.dataset.id;
                
                if (type === 'skin' && id) {
                    await this.buySkin(id);
                }
            });
        });

        document.querySelectorAll('.buy-item-ad').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.shop-item');
                const id = item?.dataset.id;
                if (id === 'double') {
                    this.purchaseWithAd();
                }
            });
        });
    }

    async buySkin(skinId) {
        const skins = { dragon: 50, phoenix: 100 };
        const price = skins[skinId];
        
        if (this.player.removeGems(price)) {
            alert(`🎉 Você adquiriu a skin ${skinId}!`);
            await update(ref(`players/${this.player.id}`), { skin: skinId });
        } else {
            alert(`❌ Gemas insuficientes! Precisa de ${price} gemas.`);
        }
    }

    purchaseWithAd() {
        alert('📺 Assistindo anúncio... (simulação)');
        this.player.data.boost = true;
        setTimeout(() => {
            this.player.data.boost = false;
        }, 1800000);
        alert('⚡ Boost ativado por 30 minutos!');
    }
}