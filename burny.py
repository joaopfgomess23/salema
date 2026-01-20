from player import Player
from card import Card

class Burny(Player):
    def __init__(self, name, player_id):
        super().__init__(name, player_id)

    def think_and_play(self, lead_suit, hearts_broken, is_first_trick, mesa):
        """
        O cérebro do Burny. Decide a melhor carta com base no estado da mesa.
        """
        legal_moves = self.get_legal_moves(lead_suit, hearts_broken, is_first_trick)
        
        if len(legal_moves) == 1:
            return legal_moves[0]

        # 1. Analisar a Mesa
        pontos_na_mesa = sum(c.score for pid, c in mesa)
        
        # 2. Se for o primeiro a abrir (Lead)
        if not mesa:
            # Tenta abrir com a carta mais baixa para não ganhar a vaza.
            # Evita abrir com Espadas altas se a Dama ainda não saiu.
            return min(legal_moves, key=lambda c: Card.STRENGTH[c.rank])

        # 3. Se estiver a seguir (Follow) ou a descartar (Discard)
        naipe_puxado = mesa[0][1].suit
        
        # Se NÃO tem o naipe (Vai descartar)
        if legal_moves[0].suit != naipe_puxado:
            # Prioridade 1: Descarregar a Dama de Espadas
            dama = [c for c in legal_moves if c.suit == 'Espadas' and c.rank == 'Q']
            if dama: return dama[0]
            # Prioridade 2: Descarregar cartas de Copas altas
            copas_altas = sorted([c for c in legal_moves if c.suit == 'Copas'], 
                                key=lambda c: Card.STRENGTH[c.rank], reverse=True)
            if copas_altas: return copas_altas[0]
            # Prioridade 3: Descarregar qualquer carta alta (Ás ou 7)
            return max(legal_moves, key=lambda c: Card.STRENGTH[c.rank])

        # Se TEM o naipe (Precisa de decidir se ganha ou perde)
        cartas_mesa_naipe = [c for pid, c in mesa if c.suit == naipe_puxado]
        maior_na_mesa = max(cartas_mesa_naipe, key=lambda c: Card.STRENGTH[c.rank])
        forca_maior = Card.STRENGTH[maior_na_mesa.rank]

        # Tentar jogar a carta mais alta que ainda PERDE a vaza
        perdedoras = [c for c in legal_moves if Card.STRENGTH[c.rank] < forca_maior]
        if perdedoras:
            return max(perdedoras, key=lambda c: Card.STRENGTH[c.rank])
        
        # Se for obrigado a ganhar, joga a mais alta para "limpar" a mão
        return max(legal_moves, key=lambda c: Card.STRENGTH[c.rank])