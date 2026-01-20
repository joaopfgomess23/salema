// Remove as atribuições antigas e usa o objeto global Pinia
const { createApp, onMounted } = Vue;

// Definição da Store
const useGameStore = Pinia.defineStore('game', {
    state: () => ({
        socket: null,
        mao: [],
        jogaveis: [],
        mesa: [],
        vaza: 1,
        pontosRonda: [0, 0, 0, 0],
        hearts_broken: false
    }),
    actions: {
        initSocket() {
            this.socket = io();
            this.socket.on('update_game', (data) => {
                this.mao = data.mao;
                this.jogaveis = data.jogaveis;
                this.mesa = data.mesa;
                this.vaza = data.vaza;
                this.pontosRonda = data.pontos_ronda;
                this.hearts_broken = data.hearts_broken;
            });
        },
        // Dentro das actions da store no Pinia:
    playCard(index) {
        // Só envia se a carta estiver na lista de jogáveis
        if (this.jogaveis.includes(index)) {
            console.log("A enviar jogada da carta índice:", index);
            this.socket.emit('play_card', { index: index });
        } else {
            console.log("Esta carta não pode ser jogada agora.");
        }
    },
        getRank(c) { return c ? c.split(' ')[0] : ''; },
        getSuitSymbol(c) {
            if (!c) return '';
            const s = c.split(' ').pop();
            const symbols = { 'Copas': '♥', 'Ouros': '♦', 'Espadas': '♠', 'Paus': '♣' };
            return symbols[s] || '';
        },
        getSuitColor(c) {
            if (!c) return '';
            const s = c.split(' ').pop();
            return (s === 'Copas' || s === 'Ouros') ? 'red' : 'black';
        }
    }
});

// Inicialização da App
const app = createApp({
    delimiters: ['${', '}'],
    setup() {
        const gameStore = useGameStore();
        onMounted(() => { gameStore.initSocket(); });
        return { gameStore };
    }
});

// Criar e usar o Pinia corretamente
const pinia = Pinia.createPinia();
app.use(pinia);
app.mount('#app');