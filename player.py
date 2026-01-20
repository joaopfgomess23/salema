from card import Card 

class Player:
    def __init__(self, name, player_id):
        self.name = name
        self.player_id = player_id
        self.__hand = []  # Lista privada de objetos Card
        self.score_history = 0 # Pontos acumulados ao longo do jogo (até 100)

    def receive_cards(self, cards):
        """Recebe a mão inicial do Deck."""
        self.__hand = self.organizar_mao(cards)
    
    def organizar_mao(self, lista_cartas):
        """
        Organiza por naipe e depois pela hierarquia da Sueca:
        2 < 3 < 4 < 5 < 6 < J < Q < K < 7 < A
        """
        # Definimos a ordem dos naipes para a visualização ser sempre igual
        ordem_naipes = {'Paus': 0, 'Ouros': 1, 'Espadas': 2, 'Copas': 3}
        
        return sorted(lista_cartas, key=lambda c: (
            ordem_naipes.get(c.suit, 99), 
            Card.STRENGTH.get(c.rank, 0)
        ))

    def show_hand(self):
        """Retorna a mão organizada."""
        return self.__hand 

    def get_card_index(self, card_obj):
        """Retorna o índice de um objeto carta específico na mão."""
        return self.__hand.index(card_obj)

    def has_suit(self, suit):
        """Verifica se o jogador tem o naipe pedido na vaza."""
        return any(card.suit == suit for card in self.__hand)

    def has_card(self, rank, suit):
        """Verifica se o jogador possui uma carta específica (ex: 2 de Paus)."""
        return any(card.rank == rank and card.suit == suit for card in self.__hand)

    def get_legal_moves(self, lead_suit, hearts_broken, is_first_trick):
        # 1. Regra absoluta da 1ª vaza: 2 de Paus
        if is_first_trick and self.has_card('2', 'Paus'):
            return [c for c in self.__hand if c.rank == '2' and c.suit == 'Paus']

        # 2. Se tiveres de assistir ao naipe (Seguir o naipe puxado)
        if lead_suit is not None:
            follow_suit = [c for c in self.__hand if c.suit == lead_suit]
            if follow_suit:
                # Na 1ª vaza, mesmo assistindo, se puder evitar pontos, evita
                if is_first_trick:
                    no_pts = [c for c in follow_suit if c.score == 0]
                    return no_pts if no_pts else follow_suit
                return follow_suit
            
            # Não tens o naipe: podes descartar qualquer carta
            # MAS na 1ª vaza não podes descartar pontos
            if is_first_trick:
                no_pts = [c for c in self.__hand if c.score == 0]
                return no_pts if no_pts else self.__hand
            return self.__hand

        # 3. Se fores o PRIMEIRO a jogar (Puxar vaza)
        if is_first_trick:
            # Na 1ª vaza não se puxa pontos (quem tem o 2 de paus já foi tratado acima)
            return [c for c in self.__hand if c.score == 0]

        # Se as copas ainda não saíram, não podes abrir com elas
        if not hearts_broken:
            non_hearts = [c for c in self.__hand if c.suit != 'Copas']
            if non_hearts:
                return non_hearts # Pode puxar qualquer uma (incluindo Dama de Espadas)
        
        return self.__hand # Se só tens copas ou já quebraram, joga qualquer uma

    def play_card(self, card_index, lead_suit, hearts_broken, is_first_trick):
        """
        Remove e retorna a carta da mão, validando se a jogada é legal.
        """
        # Passamos o hearts_broken para a validação
        legal_cards = self.get_legal_moves(lead_suit, hearts_broken, is_first_trick)
        chosen_card = self.__hand[card_index]

        if chosen_card not in legal_cards:
            raise ValueError(f"Jogada inválida!")

        return self.__hand.pop(card_index)

    @property
    def hand_size(self):
        return len(self.__hand)