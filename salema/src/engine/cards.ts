// ---------------------------------------------------------------------------
// Salema — primitivas de domínio (cartas)
//
// Este ficheiro não conhece React, servidor nem base de dados. É o núcleo puro.
// ---------------------------------------------------------------------------

export type Suit = 'clubs' | 'diamonds' | 'spades' | 'hearts';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['clubs', 'diamonds', 'spades', 'hearts'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', 'Q', 'J', 'K', 'A'];

const SUIT_CHAR: Record<Suit, string> = {
  clubs: 'C',
  diamonds: 'D',
  spades: 'S',
  hearts: 'H',
};

/**
 * Força das cartas à Sueca (decrescente: A > 7 > K > J > Q > 6 > 5 > 4 > 3 > 2).
 * Valor mais alto = carta mais forte. Só serve para decidir quem ganha a vazada.
 */
export const STRENGTH: Record<Rank, number> = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  Q: 5,
  J: 6,
  K: 7,
  '7': 8,
  A: 9,
};

/** Identificador curto e único de uma carta. Ex.: "2C", "QS", "7H", "AD". */
export function cardId(card: Card): string {
  return `${card.rank}${SUIT_CHAR[card.suit]}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Vale pontos? (qualquer Copas, ou a Dama de Espadas). */
export function isPointCard(card: Card): boolean {
  return card.suit === 'hearts' || (card.suit === 'spades' && card.rank === 'Q');
}

/** Pontos que uma carta dá a quem a captura. */
export function cardPoints(card: Card): number {
  if (card.suit === 'hearts') return 1;
  if (card.suit === 'spades' && card.rank === 'Q') return 10;
  return 0;
}

export function isQueenOfSpades(card: Card): boolean {
  return card.suit === 'spades' && card.rank === 'Q';
}

export const TWO_OF_CLUBS: Card = { suit: 'clubs', rank: '2' };

/** Baralho completo de 40 cartas (sem 8, 9 e 10). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Ordena uma mão por naipe e depois por força — apenas para apresentação. */
export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
  return cards.slice().sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    return STRENGTH[a.rank] - STRENGTH[b.rank];
  });
}
