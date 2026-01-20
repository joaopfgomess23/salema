from card import Card

class GameEngine:
    @staticmethod
    def resolve_trick(played_cards):
        """
        played_cards: Lista de tuplos (player_id, Card)
        O primeiro elemento define o naipe que "manda".
        """
        lead_suit = played_cards[0][1].suit
        winner = played_cards[0]

        for player_id, card in played_cards[1:]:
            if card.suit == lead_suit:
                if Card.STRENGTH[card.rank] > Card.STRENGTH[winner[1].rank]:
                    winner = (player_id, card)
        return winner

    @staticmethod
    def calculate_moon(points_dict):
        """
        Verifica se algum jogador atingiu 20 pontos na ronda.
        Se sim, esse jogador ganha 0 e todos os outros ganham 20.
        """
        vencedor_lua = None
        for player_id, pts in points_dict.items():
            if pts == 20:
                vencedor_lua = player_id
                break
        
        if vencedor_lua is not None:
            new_points = {}
            for player_id in points_dict:
                new_points[player_id] = 0 if player_id == vencedor_lua else 20
            return new_points, True
        
        return points_dict, False