// ---------------------------------------------------------------------------
// Salema — motor de regras (núcleo puro)
//
// Função pura de (estado, ação) -> novo estado. Sem React, sem servidor, sem BD.
// Cada chamada devolve um novo objeto de estado (imutável para o exterior).
// ---------------------------------------------------------------------------

import {
  Card,
  Suit,
  STRENGTH,
  cardId,
  sameCard,
  isPointCard,
  cardPoints,
  isQueenOfSpades,
  createDeck,
  sortHand,
} from './cards';
import { shuffle, randomSeed } from './rng';

export const NUM_PLAYERS = 5;
export const CARDS_PER_HAND = 8;
export const TRICKS_PER_HAND = 8;
export const LOSING_SCORE = 100;

export type Phase = 'playing' | 'handComplete' | 'matchComplete';

export interface TrickPlay {
  player: number;
  card: Card;
}

export interface CompletedTrick {
  leader: number;
  plays: TrickPlay[];
  winner: number;
}

export interface HandResult {
  /** Pontos crus capturados por jogador nesta mão (antes de aplicar a lua). */
  rawPoints: number[];
  /** Pontos efetivamente somados ao total (já com a lua aplicada). */
  appliedPoints: number[];
  /** Índice do jogador que acertou na lua, ou null. */
  moonShooter: number | null;
}

export interface GameState {
  readonly players: string[]; // nomes dos 5 jogadores
  readonly scores: number[]; // pontuação acumulada (quem mais tem, pior)
  readonly phase: Phase;

  // --- mão atual ---
  readonly hands: Card[][]; // cartas na mão de cada jogador
  readonly captured: Card[][]; // cartas capturadas por cada jogador nesta mão
  readonly currentTrick: TrickPlay[]; // jogadas da vazada em curso
  readonly trickLeader: number; // quem abriu a vazada em curso
  readonly ledSuit: Suit | null; // naipe pedido na vazada em curso
  readonly heartsBroken: boolean; // já se descartaram Copas?
  readonly currentPlayer: number; // de quem é a vez
  readonly trickNumber: number; // 1..8
  readonly completedTricks: CompletedTrick[];
  readonly handNumber: number; // 1..n

  // --- resultados ---
  readonly lastHandResult: HandResult | null;
  readonly losers: number[] | null; // preenchido quando phase === 'matchComplete'

  // --- interno (RNG) ---
  readonly rngState: number;
}

// ---------------------------------------------------------------------------
// Criação e distribuição
// ---------------------------------------------------------------------------

export function createMatch(players: string[], seed?: number): GameState {
  if (players.length !== NUM_PLAYERS) {
    throw new Error(`Salema joga-se com exatamente ${NUM_PLAYERS} jogadores.`);
  }
  const base: GameState = {
    players: players.slice(),
    scores: new Array(NUM_PLAYERS).fill(0),
    phase: 'playing',
    hands: [],
    captured: [],
    currentTrick: [],
    trickLeader: 0,
    ledSuit: null,
    heartsBroken: false,
    currentPlayer: 0,
    trickNumber: 1,
    completedTricks: [],
    handNumber: 0,
    lastHandResult: null,
    losers: null,
    rngState: (seed ?? randomSeed()) | 0 || 1,
  };
  return dealHand(base);
}

/** Distribui uma nova mão e coloca o detentor do 2 de Paus a abrir. */
function dealHand(state: GameState): GameState {
  const [shuffled, nextRng] = shuffle(createDeck(), state.rngState);

  const hands: Card[][] = [];
  for (let p = 0; p < NUM_PLAYERS; p++) {
    hands.push(sortHand(shuffled.slice(p * CARDS_PER_HAND, (p + 1) * CARDS_PER_HAND)));
  }

  // Quem tem o 2 de Paus abre a mão.
  let opener = 0;
  for (let p = 0; p < NUM_PLAYERS; p++) {
    if (hands[p].some((c) => c.suit === 'clubs' && c.rank === '2')) {
      opener = p;
      break;
    }
  }

  return {
    ...state,
    phase: 'playing',
    hands,
    captured: Array.from({ length: NUM_PLAYERS }, () => []),
    currentTrick: [],
    trickLeader: opener,
    ledSuit: null,
    heartsBroken: false,
    currentPlayer: opener,
    trickNumber: 1,
    completedTricks: [],
    handNumber: state.handNumber + 1,
    lastHandResult: null,
    losers: null,
    rngState: nextRng,
  };
}

// ---------------------------------------------------------------------------
// Jogadas legais
// ---------------------------------------------------------------------------

/** Devolve as cartas que o jogador da vez pode legalmente jogar. */
export function getLegalMoves(state: GameState): Card[] {
  if (state.phase !== 'playing') return [];

  const hand = state.hands[state.currentPlayer];
  const isLeading = state.currentTrick.length === 0;
  const isFirstTrick = state.trickNumber === 1;

  // Primeira jogada da mão: obrigatório o 2 de Paus.
  if (isFirstTrick && isLeading) {
    return hand.filter((c) => c.suit === 'clubs' && c.rank === '2');
  }

  if (isLeading) {
    // Abrir vazada: não se pode abrir com Copas até estarem "quebradas",
    // exceto se só houver Copas na mão.
    if (!state.heartsBroken) {
      const nonHearts = hand.filter((c) => c.suit !== 'hearts');
      if (nonHearts.length > 0) return nonHearts;
    }
    return hand.slice();
  }

  // A seguir: obrigatório seguir o naipe pedido, se possível.
  const sameSuit = hand.filter((c) => c.suit === state.ledSuit);
  if (sameSuit.length > 0) return sameSuit;

  // Não tem o naipe: pode descartar. Na 1ª vazada não pode dar pontos,
  // a menos que só tenha cartas de pontos.
  if (isFirstTrick) {
    const nonPoint = hand.filter((c) => !isPointCard(c));
    if (nonPoint.length > 0) return nonPoint;
  }
  return hand.slice();
}

export function isLegalMove(state: GameState, card: Card): boolean {
  return getLegalMoves(state).some((c) => sameCard(c, card));
}

// ---------------------------------------------------------------------------
// Aplicar uma jogada
// ---------------------------------------------------------------------------

/** Aplica a jogada do jogador da vez. Devolve um NOVO estado. */
export function playCard(state: GameState, card: Card): GameState {
  if (state.phase !== 'playing') {
    throw new Error('Não há jogada possível: a mão ou o jogo já terminaram.');
  }
  if (!isLegalMove(state, card)) {
    throw new Error(`Jogada ilegal: ${cardId(card)} não é permitida agora.`);
  }

  const player = state.currentPlayer;

  // Remove a carta da mão do jogador.
  const hands = state.hands.map((h, i) =>
    i === player ? h.filter((c) => !sameCard(c, card)) : h,
  );

  const currentTrick = [...state.currentTrick, { player, card }];
  const ledSuit = state.currentTrick.length === 0 ? card.suit : state.ledSuit;
  const heartsBroken = state.heartsBroken || card.suit === 'hearts';

  // Vazada ainda a decorrer.
  if (currentTrick.length < NUM_PLAYERS) {
    return {
      ...state,
      hands,
      currentTrick,
      ledSuit,
      heartsBroken,
      currentPlayer: (player + 1) % NUM_PLAYERS,
    };
  }

  // Vazada completa: decidir o vencedor (carta mais forte do naipe pedido).
  const winner = evaluateTrickWinner(currentTrick, ledSuit!);
  const captured = state.captured.map((pile, i) =>
    i === winner ? [...pile, ...currentTrick.map((p) => p.card)] : pile,
  );
  const completedTricks: CompletedTrick[] = [
    ...state.completedTricks,
    { leader: state.trickLeader, plays: currentTrick, winner },
  ];

  // Ainda há vazadas por jogar nesta mão — exceto se já não restarem pontos.
  // Quando nenhuma mão tem Copas nem a Dama de Espadas, o resultado já está
  // decidido: fecha-se a mão e pontua-se, sem jogar as vazadas sem pontos.
  const noPointsLeft = !hands.some((h) => h.some(isPointCard));
  if (state.trickNumber < TRICKS_PER_HAND && !noPointsLeft) {
    return {
      ...state,
      hands,
      captured,
      completedTricks,
      currentTrick: [],
      ledSuit: null,
      heartsBroken,
      trickLeader: winner,
      currentPlayer: winner,
      trickNumber: state.trickNumber + 1,
    };
  }

  // Última vazada da mão (ou já não há pontos em jogo): pontuar.
  return scoreHand({
    ...state,
    hands,
    captured,
    completedTricks,
    currentTrick: [],
    ledSuit: null,
    heartsBroken,
  });
}

/** Vencedor da vazada: a carta mais forte (à Sueca) do naipe pedido. */
export function evaluateTrickWinner(plays: TrickPlay[], ledSuit: Suit): number {
  let winner = plays[0].player;
  let best = -1;
  for (const play of plays) {
    if (play.card.suit !== ledSuit) continue;
    const strength = STRENGTH[play.card.rank];
    if (strength > best) {
      best = strength;
      winner = play.player;
    }
  }
  return winner;
}

// ---------------------------------------------------------------------------
// Pontuação da mão (incl. "acertar na lua") e fim de jogo
// ---------------------------------------------------------------------------

/**
 * Calcula a pontuação de uma mão a partir das cartas capturadas por cada jogador.
 * Função pura e testável: trata os pontos crus e o "acertar na lua".
 */
export function computeHandResult(captured: Card[][]): HandResult {
  const rawPoints = captured.map((pile) => pile.reduce((sum, c) => sum + cardPoints(c), 0));

  // Acertar na lua: um jogador capturou os 20 pontos todos (10 Copas + Q♠).
  let moonShooter: number | null = null;
  for (let p = 0; p < captured.length; p++) {
    const hearts = captured[p].filter((c) => c.suit === 'hearts').length;
    const hasQueen = captured[p].some(isQueenOfSpades);
    if (hearts === 10 && hasQueen) {
      moonShooter = p;
      break;
    }
  }

  const appliedPoints = new Array(captured.length).fill(0);
  if (moonShooter !== null) {
    // O acertador leva 0; cada adversário leva 20.
    for (let p = 0; p < captured.length; p++) {
      appliedPoints[p] = p === moonShooter ? 0 : 20;
    }
  } else {
    for (let p = 0; p < captured.length; p++) appliedPoints[p] = rawPoints[p];
  }

  return { rawPoints, appliedPoints, moonShooter };
}

function scoreHand(state: GameState): GameState {
  const handResult = computeHandResult(state.captured);
  const scores = state.scores.map((s, i) => s + handResult.appliedPoints[i]);

  // Fim de jogo: perdem TODOS os que atingem ou ultrapassam 100.
  const losers: number[] = [];
  for (let p = 0; p < NUM_PLAYERS; p++) {
    if (scores[p] >= LOSING_SCORE) losers.push(p);
  }

  if (losers.length > 0) {
    return {
      ...state,
      scores,
      phase: 'matchComplete',
      lastHandResult: handResult,
      losers,
    };
  }

  return {
    ...state,
    scores,
    phase: 'handComplete',
    lastHandResult: handResult,
    losers: null,
  };
}

/** Quando a mão termina (phase === 'handComplete'), distribui a mão seguinte. */
export function continueToNextHand(state: GameState): GameState {
  if (state.phase !== 'handComplete') {
    throw new Error('Só se pode continuar quando a mão terminou.');
  }
  return dealHand(state);
}

// ---------------------------------------------------------------------------
// Seletores úteis para a interface
// ---------------------------------------------------------------------------

export function isMatchOver(state: GameState): boolean {
  return state.phase === 'matchComplete';
}

export function legalMoveIds(state: GameState): Set<string> {
  return new Set(getLegalMoves(state).map(cardId));
}

export function handPointsSoFar(state: GameState, player: number): number {
  return state.captured[player].reduce((sum, c) => sum + cardPoints(c), 0);
}

export { cardId, sameCard, cardPoints, isPointCard, isQueenOfSpades, sortHand };
export type { Card, Suit, Rank } from './cards';
