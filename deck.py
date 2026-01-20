import random
from card import Card

class Deck:
    def __init__(self):
        self.__cards = []
        self.__reset_and_filter()

    def __reset_and_filter(self):
        """Cria o baralho de 40 cartas (exclui 8, 9 e 10)."""
        naipes = ['Paus', 'Ouros', 'Espadas', 'Copas']
        # Apenas os valores permitidos para este projeto
        valores = ['2', '3', '4', '5', '6', '7', 'J', 'Q', 'K', 'A']
        
        self.__cards = [Card(n, v) for n in naipes for v in valores]

    def shuffle(self):
        """Baralha as cartas disponíveis."""
        random.shuffle(self.__cards)

    def deal(self, num_players):
        """
        Divide as 40 cartas igualmente entre os jogadores.
        Retorna uma lista de listas de cartas.
        """
        if num_players not in [4, 5]:
            raise ValueError("O jogo suporta apenas 4 ou 5 jogadores.")

        self.shuffle()
        cards_per_player = len(self.__cards) // num_players
        
        hands = []
        for i in range(num_players):
            start = i * cards_per_player
            end = start + cards_per_player
            hands.append(self.__cards[start:end])
            
        return hands

    def __len__(self):
        return len(self.__cards)