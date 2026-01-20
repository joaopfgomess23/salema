from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from deck import Deck
from burny import Burny
from player import Player
from engine import GameEngine

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

class GameState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.players = [Player("Tu", 0), Burny("Burny 1", 1), Burny("Burny 2", 2), Burny("Burny 3", 3)]
        self.engine = GameEngine()
        self.current_player_idx = 0
        self.vaza_atual = 1
        self.mesa = []
        self.naipe_puxado = None
        self.hearts_broken = False
        self.pontos_ronda = {0:0, 1:0, 2:0, 3:0}

game = GameState()

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    # Se o jogo ainda não começou, iniciamos
    if not game.players[0].show_hand():
        handle_start()
    else:
        emit_game_state()

@socketio.on('start_game')
def handle_start():
    game.reset()
    deck = Deck()
    maos = deck.deal(4)
    for i, mao in enumerate(maos):
        game.players[i].receive_cards(mao)
        if game.players[i].has_card('2', 'Paus'):
            game.current_player_idx = i
    
    # Se o primeiro a jogar não for o humano (ID 0), os bots jogam até chegar ao humano
    if game.current_player_idx != 0:
        bots_play_turn()
    
    emit_game_state()

@socketio.on('play_card')
def handle_play(data):
    card_index = data.get('index') # O Vue envia { index: X }
    p_humano = game.players[0]
    
    # Verifica se é a tua vez (current_player_idx deve ser 0)
    if game.current_player_idx != 0:
        print("Ainda não é a tua vez!")
        return 

    # Lógica de validação da jogada...
    is_first = (game.vaza_atual == 1)
    legal_moves = p_humano.get_legal_moves(game.naipe_puxado, game.hearts_broken, is_first)
    minha_mao = p_humano.show_hand()
    
    if card_index < len(minha_mao):
        carta = minha_mao[card_index]
        if carta in legal_moves:
            p_humano.play_card(card_index, game.naipe_puxado, game.hearts_broken, is_first)
            registrar_jogada(0, carta)
            bots_play_turn() # Faz os bots responderem
            emit_game_state() # Atualiza o site

def bots_play_turn():
    while game.current_player_idx != 0 and game.vaza_atual <= 10:
        bot = game.players[game.current_player_idx]
        is_first_bot = (game.vaza_atual == 1)
        
        carta_bot = bot.think_and_play(game.naipe_puxado, game.hearts_broken, is_first_bot, game.mesa)
        
        # Remover da mão do bot
        idx_na_mao = bot.show_hand().index(carta_bot)
        bot.play_card(idx_na_mao, game.naipe_puxado, game.hearts_broken, is_first_bot)
        
        registrar_jogada(game.current_player_idx, carta_bot)
        
        # Se a vaza fechou, o vencedor começa. Se for bot, o loop continua.
        # Se for o humano, o loop para e aguarda clique.

def registrar_jogada(player_id, carta):
    if not game.mesa:
        game.naipe_puxado = carta.suit
    
    if carta.suit == 'Copas':
        game.hearts_broken = True
        
    game.mesa.append((player_id, carta))
    
    if len(game.mesa) == 4:
        # AQUI: Mudámos para vencedor_id para ser consistente
        vencedor_id, _ = game.engine.resolve_trick(game.mesa)
        pts = sum(c.score for pid, c in game.mesa)
        game.pontos_ronda[vencedor_id] += pts
        game.current_player_idx = vencedor_id
        game.mesa = []
        game.naipe_puxado = None
        game.vaza_atual += 1
    else:
        game.current_player_idx = (game.current_player_idx + 1) % 4

    emit_game_state()

def emit_game_state():
    p_humano = game.players[0]
    is_first = (game.vaza_atual == 1)
    legal_moves = p_humano.get_legal_moves(game.naipe_puxado, game.hearts_broken, is_first)
    
    state = {
        'mao': [str(c) for c in p_humano.show_hand()],
        'jogaveis': [i for i, c in enumerate(p_humano.show_hand()) if c in legal_moves],
        'mesa': [(pid, str(c)) for pid, c in game.mesa],
        'vaza': game.vaza_atual,
        'vez_de': game.current_player_idx,
        'pontos_ronda': list(game.pontos_ronda.values()),
        'pontos_geral': [p.score_history for p in game.players]
    }
    socketio.emit('update_game', state)

if __name__ == '__main__':
    socketio.run(app, debug=True)