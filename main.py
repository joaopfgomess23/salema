from deck import Deck
from player import Player
from burny import Burny
from engine import GameEngine
import os

def limpar_ecra():
    os.system('cls' if os.name == 'nt' else 'clear')

def exibir_painel(vaza_atual, hearts_broken, players, pontos_da_ronda, idx_atual, mesa, naipe_puxado):
    print("=" * 45)
    print(f" VAZA {vaza_atual} / 10  |  Copas: {'ABERTAS' if hearts_broken else 'FECHADAS'}")
    print("-" * 45)
    print(f"{'JOGADOR':<15} | {'GERAL':<8} | {'RONDA':<8}")
    for j, p in enumerate(players):
        # Mostra de quem é a vez com '>>'
        prefix = ">> " if j == idx_atual else "   "
        print(f"{prefix}{p.name:<12} | {p.score_history:<8} | {pontos_da_ronda[j]:<8}")
    print("=" * 45)
    
    if mesa:
        print("\nCARTAS NA MESA:")
        for pid, card in mesa:
            print(f"  {players[pid].name:.<12} jogou {card}")
    
    print(f"\n[ TUAS CARTAS ] - Naipe puxado: {naipe_puxado}")
    
    # Mostrar as cartas do jogador humano (Tu)
    p_humano = players[0] 
    is_first = (vaza_atual == 1)
    legal_moves = p_humano.get_legal_moves(naipe_puxado, hearts_broken, is_first)
    for m_idx, carta in enumerate(p_humano.show_hand()):
        status = f"[{m_idx}]" if carta in legal_moves else " [X] "
        print(f"{status} {carta}")

def main():
    num_jogadores = 4
    # Criamos o Jogador 1 como "Tu"
    players = [Player("Tu", 0)]
    for i in range(1, num_jogadores):
        players.append(Burny(f"Burny {i}", i))

    engine = GameEngine()
    
    game_over = False
    
    while not game_over:
        deck = Deck()
        maos = deck.deal(num_jogadores)
        for i, mao in enumerate(maos):
            players[i].receive_cards(mao)
        
        current_player_idx = 0
        for i, p in enumerate(players):
            if p.has_card('2', 'Paus'):
                current_player_idx = i
                break
        
        input(f"\nO jogo vai começar! {players[current_player_idx].name} tem o 2 de Paus. Prime Enter...")
        
        hearts_broken = False
        pontos_da_ronda = {i: 0 for i in range(num_jogadores)}
        
        vaza_atual = 1
        total_vazas = 40 // num_jogadores # 10 para 4 jogadores, 8 para 5
        
        vaza_atual = 1
        hearts_broken = False
        pontos_da_ronda = {i: 0 for i in range(num_jogadores)}

        while players[0].hand_size > 0:
            mesa = []
            naipe_puxado = None
            is_first_trick = (vaza_atual == 1)

            for i in range(num_jogadores):
                # Calcula quem é o jogador atual neste turno da vaza
                idx = (current_player_idx + i) % num_jogadores
                p = players[idx]
                
                # 1. Decisão da Carta
                if isinstance(p, Burny):
                    # O Bot decide usando a sua própria lógica
                    carta_para_jogar = p.think_and_play(naipe_puxado, hearts_broken, is_first_trick, mesa)
                else:
                    # Interface para o Humano (Tu)
                    limpar_ecra()
                    exibir_painel(vaza_atual, hearts_broken, players, pontos_da_ronda, idx, mesa, naipe_puxado)
                    
                    legal_moves = p.get_legal_moves(naipe_puxado, hearts_broken, is_first_trick)
                    minha_mao = p.show_hand()
                    
                    while True:
                        try:
                            escolha = int(input("\nEscolhe o número da carta: "))
                            carta_para_jogar = minha_mao[escolha]
                            if carta_para_jogar in legal_moves:
                                break
                            print("Essa carta não é permitida!")
                        except (ValueError, IndexError):
                            print("Entrada inválida! Digita o número ao lado da carta.")

                # 2. Execução da Jogada
                if carta_para_jogar.suit == 'Copas':
                    hearts_broken = True
                
                # Remove a carta da mão do jogador (seja bot ou humano)
                c_idx = p.show_hand().index(carta_para_jogar)
                p.play_card(c_idx, naipe_puxado, hearts_broken, is_first_trick)
                
                # Define o naipe da vaza se for o primeiro a jogar
                if i == 0:
                    naipe_puxado = carta_para_jogar.suit
                
                # Adiciona à mesa e mostra a todos o que foi jogado
                mesa.append((p.player_id, carta_para_jogar))
                print(f"-> {p.name} jogou {carta_para_jogar}")

            # 3. Finalização da Vaza
            vencedor_id, carta_venc = engine.resolve_trick(mesa)
            pts_vaza = sum(c.score for pid, c in mesa)
            pontos_da_ronda[vencedor_id] += pts_vaza
            current_player_idx = vencedor_id
            
            print(f"\n>>> {players[vencedor_id].name} ganhou a vaza com {carta_venc} (+{pts_vaza} pts)")
            input("\nPrime Enter para a próxima vaza...")
            vaza_atual += 1

        # --- FINAL DA RONDA (FORA DO WHILE DAS VAZAS) ---
        pontos_finais_ronda, lua_aconteceu = engine.calculate_moon(pontos_da_ronda)
        
        if lua_aconteceu:
            print("\n!!! ACERTOU NA LUA !!!")
            print("Um jogador fez 20 pontos. Os adversários recebem 20 pontos cada!")

        for i, p in enumerate(players):
            p.score_history += pontos_finais_ronda[i]
            if p.score_history >= 100:
                game_over = True
                print(f"\n{p.name} atingiu os 100 pontos!")

    print("\nFIM DO JOGO!")

if __name__ == "__main__":
    main()