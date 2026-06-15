import { describe, it, expect } from 'vitest';
import {
  createMatch,
  getLegalMoves,
  playCard,
  continueToNextHand,
  evaluateTrickWinner,
  computeHandResult,
  createDeck,
  cardPoints,
  cardId,
  STRENGTH,
  GameState,
  TrickPlay,
  Card,
} from '../index';

// Atalho para criar cartas: c('7', 'hearts')
const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

// Constrói um estado completo a partir de um parcial, para testar regras isoladas.
function makeState(partial: Partial<GameState>): GameState {
  return {
    players: ['A', 'B', 'C', 'D', 'E'],
    scores: [0, 0, 0, 0, 0],
    phase: 'playing',
    hands: [[], [], [], [], []],
    captured: [[], [], [], [], []],
    currentTrick: [],
    trickLeader: 0,
    ledSuit: null,
    heartsBroken: false,
    currentPlayer: 0,
    trickNumber: 2, // por omissão, NÃO é a 1ª vazada
    completedTricks: [],
    handNumber: 1,
    lastHandResult: null,
    losers: null,
    rngState: 1,
    ...partial,
  };
}

describe('Baralho e cartas', () => {
  it('tem 40 cartas, 10 por naipe, sem 8/9/10', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(40);
    expect(new Set(deck.map(cardId)).size).toBe(40);
    expect(deck.some((x) => ['8', '9', '10'].includes(x.rank as string))).toBe(false);
  });

  it('a ordenação à Sueca é A > 7 > K > J > Q > 6 > 5 > 4 > 3 > 2', () => {
    expect(STRENGTH.A).toBeGreaterThan(STRENGTH['7']);
    expect(STRENGTH['7']).toBeGreaterThan(STRENGTH.K);
    expect(STRENGTH.K).toBeGreaterThan(STRENGTH.J);
    expect(STRENGTH.J).toBeGreaterThan(STRENGTH.Q);
    expect(STRENGTH.Q).toBeGreaterThan(STRENGTH['6']);
    expect(STRENGTH['6']).toBeGreaterThan(STRENGTH['2']);
  });

  it('pontuação: cada Copas = 1, Dama de Espadas = 10, resto 0; total 20', () => {
    expect(cardPoints(c('A', 'hearts'))).toBe(1);
    expect(cardPoints(c('Q', 'spades'))).toBe(10);
    expect(cardPoints(c('A', 'spades'))).toBe(0);
    expect(cardPoints(c('K', 'clubs'))).toBe(0);
    const total = createDeck().reduce((s, x) => s + cardPoints(x), 0);
    expect(total).toBe(20);
  });
});

describe('Distribuição e abertura', () => {
  it('dá 8 cartas a cada um dos 5 jogadores (40 no total, sem repetições)', () => {
    const s = createMatch(['A', 'B', 'C', 'D', 'E'], 12345);
    expect(s.hands.every((h) => h.length === 8)).toBe(true);
    const all = s.hands.flat();
    expect(all).toHaveLength(40);
    expect(new Set(all.map(cardId)).size).toBe(40);
  });

  it('quem tem o 2 de Paus abre a mão e é o jogador da vez', () => {
    const s = createMatch(['A', 'B', 'C', 'D', 'E'], 999);
    const opener = s.currentPlayer;
    expect(s.hands[opener].some((x) => x.suit === 'clubs' && x.rank === '2')).toBe(true);
    expect(s.trickLeader).toBe(opener);
    expect(s.trickNumber).toBe(1);
  });

  it('a primeira jogada obrigatória é o 2 de Paus', () => {
    const s = createMatch(['A', 'B', 'C', 'D', 'E'], 999);
    const legal = getLegalMoves(s);
    expect(legal).toHaveLength(1);
    expect(cardId(legal[0])).toBe('2C');
  });
});

describe('Seguir o naipe', () => {
  it('obriga a seguir o naipe pedido quando há cartas desse naipe', () => {
    const s = makeState({
      currentPlayer: 1,
      ledSuit: 'diamonds',
      currentTrick: [{ player: 0, card: c('K', 'diamonds') }],
      hands: [[], [c('5', 'diamonds'), c('A', 'diamonds'), c('K', 'hearts')], [], [], []],
    });
    const legal = getLegalMoves(s).map(cardId).sort();
    expect(legal).toEqual(['5D', 'AD']);
  });

  it('permite qualquer carta quando não há o naipe pedido (fora da 1ª vazada)', () => {
    const s = makeState({
      currentPlayer: 1,
      ledSuit: 'diamonds',
      currentTrick: [{ player: 0, card: c('K', 'diamonds') }],
      hands: [[], [c('5', 'clubs'), c('Q', 'spades'), c('K', 'hearts')], [], [], []],
    });
    const legal = getLegalMoves(s).map(cardId).sort();
    expect(legal).toEqual(['5C', 'KH', 'QS']);
  });
});

describe('Restrição da 1ª vazada (sem pontos)', () => {
  it('não deixa descartar pontos na 1ª vazada se houver cartas sem pontos', () => {
    const s = makeState({
      trickNumber: 1,
      currentPlayer: 1,
      ledSuit: 'clubs',
      currentTrick: [{ player: 0, card: c('2', 'clubs') }],
      hands: [[], [c('5', 'diamonds'), c('Q', 'spades'), c('K', 'hearts')], [], [], []],
    });
    // Só o 5 de Ouros (não-ponto) é legal; Q♠ e Copas ficam de fora.
    expect(getLegalMoves(s).map(cardId)).toEqual(['5D']);
  });

  it('permite jogar pontos na 1ª vazada se SÓ houver cartas de pontos', () => {
    const s = makeState({
      trickNumber: 1,
      currentPlayer: 1,
      ledSuit: 'clubs',
      currentTrick: [{ player: 0, card: c('2', 'clubs') }],
      hands: [[], [c('Q', 'spades'), c('K', 'hearts'), c('2', 'hearts')], [], [], []],
    });
    expect(getLegalMoves(s).map(cardId).sort()).toEqual(['2H', 'KH', 'QS']);
  });
});

describe('Quebrar Copas', () => {
  it('não deixa abrir com Copas antes de quebradas (havendo outros naipes)', () => {
    const s = makeState({
      currentPlayer: 0,
      currentTrick: [],
      heartsBroken: false,
      hands: [[c('A', 'hearts'), c('5', 'clubs'), c('K', 'spades')], [], [], [], []],
    });
    const legal = getLegalMoves(s).map(cardId).sort();
    expect(legal).toEqual(['5C', 'KS']); // sem Copas
  });

  it('deixa abrir com Copas depois de quebradas', () => {
    const s = makeState({
      currentPlayer: 0,
      currentTrick: [],
      heartsBroken: true,
      hands: [[c('A', 'hearts'), c('5', 'clubs')], [], [], [], []],
    });
    expect(getLegalMoves(s).map(cardId).sort()).toEqual(['5C', 'AH']);
  });

  it('deixa abrir com Copas se o jogador só tiver Copas', () => {
    const s = makeState({
      currentPlayer: 0,
      currentTrick: [],
      heartsBroken: false,
      hands: [[c('A', 'hearts'), c('5', 'hearts')], [], [], [], []],
    });
    expect(getLegalMoves(s).map(cardId).sort()).toEqual(['5H', 'AH']);
  });
});

describe('Vencedor da vazada', () => {
  it('ganha a carta mais forte do naipe pedido (7 ganha ao Rei)', () => {
    const plays: TrickPlay[] = [
      { player: 0, card: c('K', 'clubs') },
      { player: 1, card: c('7', 'clubs') },
      { player: 2, card: c('Q', 'clubs') },
    ];
    expect(evaluateTrickWinner(plays, 'clubs')).toBe(1);
  });

  it('cartas de outro naipe não ganham (Ás de outro naipe não conta)', () => {
    const plays: TrickPlay[] = [
      { player: 0, card: c('5', 'diamonds') },
      { player: 1, card: c('A', 'spades') }, // naipe diferente
      { player: 2, card: c('6', 'diamonds') },
    ];
    expect(evaluateTrickWinner(plays, 'diamonds')).toBe(2);
  });
});

describe('Pontuação da mão e acertar na lua', () => {
  it('atribui os pontos a quem capturou as cartas', () => {
    const captured: Card[][] = [
      [c('Q', 'spades'), c('A', 'hearts')], // 10 + 1 = 11
      [c('2', 'hearts')], // 1
      [],
      [],
      [],
    ];
    // (faltam cartas para os 20, mas o cálculo é sobre o que foi capturado)
    const r = computeHandResult(captured);
    expect(r.moonShooter).toBeNull();
    expect(r.appliedPoints[0]).toBe(11);
    expect(r.appliedPoints[1]).toBe(1);
  });

  it('acertar na lua: o acertador leva 0 e os outros 20 cada', () => {
    const hearts: Card[] = (['2', '3', '4', '5', '6', '7', 'Q', 'J', 'K', 'A'] as Card['rank'][]).map(
      (r) => c(r, 'hearts'),
    );
    const captured: Card[][] = [[...hearts, c('Q', 'spades')], [], [], [], []];
    const r = computeHandResult(captured);
    expect(r.moonShooter).toBe(0);
    expect(r.appliedPoints).toEqual([0, 20, 20, 20, 20]);
  });
});

describe('Fim de jogo e perdedores', () => {
  it('o jogo termina e perdem TODOS os jogadores com pontuação >= 100', () => {
    // Última vazada (8ª). Os 20 pontos da mão estão distribuídos nas capturas
    // anteriores: jogador 0 tem a Q♠ (10), o 1 tem 1 Copas, o 2 tem 9 Copas.
    const nineHearts: Card[] = (
      ['2', '3', '4', '5', '6', '7', 'Q', 'J', 'K'] as Card['rank'][]
    ).map((r) => c(r, 'hearts'));
    const s = makeState({
      scores: [95, 99, 10, 10, 10],
      trickNumber: 8,
      trickLeader: 1,
      ledSuit: 'clubs',
      currentPlayer: 0,
      currentTrick: [
        { player: 1, card: c('2', 'clubs') },
        { player: 2, card: c('3', 'clubs') },
        { player: 3, card: c('4', 'clubs') },
        { player: 4, card: c('5', 'clubs') },
      ],
      hands: [[c('6', 'clubs')], [], [], [], []], // jogador 0 ganha com o 6 de Paus
      captured: [[c('Q', 'spades')], [c('A', 'hearts')], nineHearts, [], []],
    });
    const next = playCard(s, c('6', 'clubs'));
    // pontos da mão: [10, 1, 9, 0, 0] -> scores: [105, 100, 19, 10, 10]
    expect(next.phase).toBe('matchComplete');
    expect(next.scores).toEqual([105, 100, 19, 10, 10]);
    expect(next.losers).toEqual([0, 1]); // ambos >= 100
  });

  it('a lua pode empurrar 4 adversários para >= 100 e todos perdem', () => {
    const allHearts: Card[] = (
      ['2', '3', '4', '5', '6', '7', 'Q', 'J', 'K', 'A'] as Card['rank'][]
    ).map((r) => c(r, 'hearts'));
    // jogador 4 acerta na lua
    const captured: Card[][] = [[], [], [], [], [...allHearts, c('Q', 'spades')]];
    const r = computeHandResult(captured);
    expect(r.moonShooter).toBe(4);
    expect(r.appliedPoints).toEqual([20, 20, 20, 20, 0]);

    const base = [85, 85, 85, 85, 99];
    const scores = base.map((v, i) => v + r.appliedPoints[i]); // [105,105,105,105,99]
    const losers = scores.map((v, i) => (v >= 100 ? i : -1)).filter((i) => i >= 0);
    expect(losers).toEqual([0, 1, 2, 3]); // o acertador (4) NÃO perde
  });
});

describe('Integração: mão completa determinística', () => {
  it('joga uma mão inteira escolhendo sempre a 1ª jogada legal e conserva os 20 pontos', () => {
    let s = createMatch(['A', 'B', 'C', 'D', 'E'], 4242);
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 100) {
      const legal = getLegalMoves(s);
      s = playCard(s, legal[0]);
    }
    expect(s.phase).not.toBe('playing'); // a mão terminou
    expect(s.completedTricks).toHaveLength(8);
    // todas as cartas foram jogadas
    expect(s.hands.flat()).toHaveLength(0);
    // conservação: os pontos crus somam 20
    const total = s.lastHandResult!.rawPoints.reduce((a, b) => a + b, 0);
    expect(total).toBe(20);
    // o total aplicado é 20 (sem lua) ou 80 (com lua: 4 x 20)
    const applied = s.lastHandResult!.appliedPoints.reduce((a, b) => a + b, 0);
    expect([20, 80]).toContain(applied);
  });

  it('consegue encadear mãos até alguém perder', () => {
    let s = createMatch(['A', 'B', 'C', 'D', 'E'], 7);
    let guard = 0;
    while (s.phase !== 'matchComplete' && guard++ < 5000) {
      if (s.phase === 'handComplete') {
        s = continueToNextHand(s);
        continue;
      }
      const legal = getLegalMoves(s);
      s = playCard(s, legal[0]);
    }
    expect(s.phase).toBe('matchComplete');
    expect(s.losers!.length).toBeGreaterThan(0);
    expect(s.losers!.every((p) => s.scores[p] >= 100)).toBe(true);
  });
});
