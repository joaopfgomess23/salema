class Card:
    # Hierarquia da Sueca
    STRENGTH = {'2': 0, '3': 1, '4': 2, '5': 3, '6': 4, 'J': 5, 'Q': 6, 'K': 7, '7': 8, 'A': 9}

    def __init__(self, suit, rank):
        self.__suit = suit  # Atributo privado
        self.__rank = rank

    @property
    def suit(self): return self.__suit

    @property
    def rank(self): return self.__rank

    @property
    def score(self):
        if self.__suit == 'Espadas' and self.__rank == 'Q': return 10
        if self.__suit == 'Copas': return 1
        return 0

    def __repr__(self):
        return f"{self.__rank} de {self.__suit}"