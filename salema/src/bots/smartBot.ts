// ---------------------------------------------------------------------------
// Bot inteligente (contagem de cartas + tentativa de "acertar na lua").
//
// Sem memória própria: em cada jogada lê o GameState (vazadas já terminadas,
// vazada em curso, capturas) e reconstrói o que precisa. Nunca olha para as
// cartas dos adversários — só para a sua mão e para informação pública.
//
// Ideias principais:
//  1. Contagem de cartas: sabe que cartas ainda não saíram e quem já não tem
//     certos naipes (porque descartou quando esse naipe foi pedido).
//  2. Modo "20": quando a probabilidade de apanhar todos os pontos passa o
//     limite do perfil, tenta ganhar todas as vazadas com pontos. Se for o
//     único com um naipe, abre esse naipe (os outros são obrigados a descartar).
//  3. Modo normal: ao abrir, escolhe a carta com menor "custo" esperado em
//     pontos. Uma Copa baixa deixa de ser tabu quando ainda há muitas Copas
//     por sair e é provável que outro jogador fique com a vazada.
// ---------------------------------------------------------------------------

import { GameState, getLegalMoves } from '../engine';
import {
  Card,
  Suit,
  STRENGTH,
  SUITS,
  cardId,
  cardPoints,
  createDeck,
  isPointCard,
  isQueenOfSpades,
} from '../engine/cards';

// ---------------------------------------------------------------------------
// Perfis (personalidades)
// ---------------------------------------------------------------------------

export type BotStyle =
  | 'muito cauteloso'
  | 'cauteloso'
  | 'equilibrado'
  | 'arrojado'
  | 'agressivo'
  | 'muito agressivo';

export interface BotProfile {
  id: number;
  name: string;
  style: BotStyle;
  /** Probabilidade mínima (0..1) de apanhar os 20 pontos para o bot tentar. */
  moonThreshold: number;
  /** Nº mínimo de Copas por sair para o bot abrir com uma Copa baixa sem medo. */
  heartsRemainingMin: number;
  /** Quanto "desconto" (em pontos esperados) ganha uma Copa baixa ao abrir. */
  heartLeadBonus: number;
}

export const DEFAULT_PROFILE: BotProfile = {
  id: 0,
  name: 'Bot',
  style: 'equilibrado',
  moonThreshold: 0.63,
  heartsRemainingMin: 5,
  heartLeadBonus: 0.6,
};

// Constantes do modelo (podes afinar aqui).
const TOTAL_POINT_CARDS = 11; // 10 Copas + Dama de Espadas
const HEART_LEAD_MAX_WIN_PROB = 0.35; // só abre Copa "sem medo" se a hipótese de ganhar for baixa
const QS_DUMP_CHANCE = 0.9; // quem não tem o naipe larga a Dama quase sempre
const QS_SPADE_FOLLOW_CHANCE = 0.4; // chance de a Dama cair numa vazada de Espadas
const HEART_DUMP_VALUE = 0.6; // valor esperado (em pontos) de uma Copa largada por quem não tem o naipe

const strength = (card: Card): number => STRENGTH[card.rank];
const byStrength = (a: Card, b: Card): number => strength(a) - strength(b);
const lowest = (cards: Card[]): Card => [...cards].sort(byStrength)[0];
const highest = (cards: Card[]): Card => [...cards].sort(byStrength).at(-1)!;

type Plays = GameState['currentTrick'];

// ---------------------------------------------------------------------------
// Contexto: o que o bot consegue deduzir do estado
// ---------------------------------------------------------------------------

interface Ctx {
  me: number;
  numPlayers: number;
  hand: Card[];
  /** Cartas que ainda não saíram e não estão na minha mão (estão nos adversários). */
  unseenBySuit: Record<Suit, Card[]>;
  qsUnseen: boolean;
  /** Naipes em que cada jogador já se sabe que não tem cartas. */
  voids: Set<Suit>[];
  /** Nº de cartas na mão de cada jogador (informação pública). */
  handSizes: number[];
}

function buildContext(state: GameState): Ctx {
  const me = state.currentPlayer;
  const numPlayers = state.players.length;
  const hand = state.hands[me];

  const seen = new Set<string>(hand.map(cardId));
  const voids: Set<Suit>[] = Array.from({ length: numPlayers }, () => new Set<Suit>());

  const register = (plays: Plays) => {
    if (plays.length === 0) return;
    const led = plays[0].card.suit;
    for (const p of plays) {
      seen.add(cardId(p.card));
      if (p.card.suit !== led) voids[p.player].add(led);
    }
  };
  for (const t of state.completedTricks) register(t.plays);
  register(state.currentTrick);

  const unseenBySuit = { clubs: [], diamonds: [], spades: [], hearts: [] } as Record<Suit, Card[]>;
  for (const c of createDeck()) {
    if (!seen.has(cardId(c))) unseenBySuit[c.suit].push(c);
  }
  for (const s of SUITS) unseenBySuit[s].sort(byStrength);

  return {
    me,
    numPlayers,
    hand,
    unseenBySuit,
    qsUnseen: unseenBySuit.spades.some(isQueenOfSpades),
    voids,
    handSizes: state.hands.map((h) => h.length),
  };
}

/** Probabilidade (aprox.) de cada adversário ter cartas de um naipe, proporcional ao tamanho da mão. */
function holderWeights(ctx: Ctx, suit: Suit): number[] {
  const w = ctx.handSizes.map((n, j) => (j === ctx.me || ctx.voids[j].has(suit) ? 0 : n));
  const total = w.reduce((a, b) => a + b, 0);
  return total === 0 ? w : w.map((x) => x / total);
}

/**
 * Probabilidade de eu GANHAR a vazada se abrir com esta carta, assumindo que os
 * adversários fogem à vazada sempre que podem (só ganham se forem obrigados,
 * isto é, se todas as cartas que têm do naipe forem mais altas que a minha).
 */
function pWinLeading(ctx: Ctx, card: Card): number {
  const list = ctx.unseenBySuit[card.suit];
  const U = list.length;
  if (U === 0) return 1; // sou o único com este naipe
  const L = list.filter((c) => strength(c) < strength(card)).length; // por sair e mais baixas
  const w = holderWeights(ctx, card.suit);
  let p = 1;
  for (let j = 0; j < w.length; j++) {
    if (w[j] === 0) continue;
    // Forçado a ficar com a vazada: tem pelo menos 1 carta do naipe e nenhuma é mais baixa que a minha.
    const forced = Math.pow(1 - w[j], L) - Math.pow(1 - w[j], U);
    p *= 1 - forced;
  }
  return p;
}

/** Pontos esperados que os adversários põem numa vazada aberta neste naipe. */
function expectedLeadPoints(ctx: Ctx, suit: Suit): number {
  const U = ctx.unseenBySuit[suit].length;
  const w = holderWeights(ctx, suit);
  const wSpades = holderWeights(ctx, 'spades');
  let pts = 0;
  for (let j = 0; j < w.length; j++) {
    if (j === ctx.me) continue;
    const pHas = 1 - Math.pow(1 - w[j], U);
    const pVoid = 1 - pHas;
    const pQS = ctx.qsUnseen ? wSpades[j] : 0;
    if (suit === 'hearts') pts += pHas; // quem tem Copas segue com uma Copa (1 ponto)
    if (suit === 'spades') pts += 10 * pQS * QS_SPADE_FOLLOW_CHANCE;
    // Quem não tem o naipe larga pontos (Dama primeiro, senão uma Copa).
    const queenDump = suit === 'spades' ? 0 : 10 * pQS * QS_DUMP_CHANCE;
    pts += pVoid * (queenDump + HEART_DUMP_VALUE);
  }
  return pts;
}

function winningStrength(state: GameState): number {
  return Math.max(
    ...state.currentTrick.filter((p) => p.card.suit === state.ledSuit).map((p) => strength(p.card)),
  );
}

// ---------------------------------------------------------------------------
// Probabilidade de "ir para o 20"
// ---------------------------------------------------------------------------

/**
 * Estimativa (heurística) da probabilidade de apanhar TODOS os pontos.
 *  - Impossível se um adversário já apanhou pontos, ou se a vazada em curso tem
 *    pontos que já não consigo ganhar.
 *  - Só as vazadas com pontos têm de ser ganhas: no máximo há tantas quantas as
 *    cartas de pontos que faltam. As restantes (folga) podem perder-se.
 *  - Cada carta que tenho de "fazer valer" conta com a sua hipótese de ganhar;
 *    multiplicam-se, deixando de fora as mais fracas (a folga).
 */
function moonProbability(state: GameState, ctx: Ctx, legal: Card[]): number {
  for (let i = 0; i < ctx.numPlayers; i++) {
    if (i !== ctx.me && state.captured[i].some(isPointCard)) return 0;
  }
  const capturedPoints = state.captured.reduce((n, pile) => n + pile.filter(isPointCard).length, 0);
  const remaining = TOTAL_POINT_CARDS - capturedPoints;
  if (remaining <= 0) return 0;

  if (state.currentTrick.length > 0 && state.currentTrick.some((p) => isPointCard(p.card))) {
    const best = winningStrength(state);
    const canWin = legal.some((c) => c.suit === state.ledSuit && strength(c) > best);
    if (!canWin) return 0;
  }

  const probs = ctx.hand.map((c) => pWinLeading(ctx, c)).sort((a, b) => a - b);
  const slack = Math.max(0, ctx.hand.length - remaining);
  return probs.slice(slack).reduce((prod, p) => prod * p, 1);
}

// ---------------------------------------------------------------------------
// Modo "20": tentar ganhar todas as vazadas com pontos
// ---------------------------------------------------------------------------

function chooseMoonMove(state: GameState, ctx: Ctx, legal: Card[]): Card | null {
  // A abrir: naipe exclusivo primeiro (os outros são obrigados a descartar),
  // depois a carta com maior hipótese de ganhar.
  if (state.currentTrick.length === 0) {
    const scored = legal.map((card) => ({
      card,
      exclusive: ctx.unseenBySuit[card.suit].length === 0,
      win: pWinLeading(ctx, card),
      pts: expectedLeadPoints(ctx, card.suit),
    }));
    scored.sort(
      (a, b) =>
        Number(b.exclusive) - Number(a.exclusive) ||
        b.win - a.win ||
        b.pts - a.pts ||
        strength(a.card) - strength(b.card),
    );
    return scored[0].card;
  }

  const led = state.ledSuit!;
  const following = legal.every((c) => c.suit === led);

  if (following) {
    const best = winningStrength(state);
    const winners = legal.filter((c) => strength(c) > best).sort(byStrength);
    if (winners.length === 0) return null; // não consigo ganhar: o modo 20 falhou

    const isLastSeat = state.currentTrick.length === ctx.numPlayers - 1;
    if (isLastSeat) return winners[0]; // ninguém me pode ultrapassar: a mais baixa que ganha

    // Jogadores que ainda vão jogar nesta vazada e podem ter o naipe.
    const played = new Set(state.currentTrick.map((p) => p.player));
    const stillToPlay = [...Array(ctx.numPlayers).keys()].filter((j) => j !== ctx.me && !played.has(j));
    const someoneCanFollow = stillToPlay.some((j) => !ctx.voids[j].has(led));
    const threatened = (c: Card) =>
      someoneCanFollow && ctx.unseenBySuit[led].some((u) => strength(u) > strength(c));

    return winners.find((c) => !threatened(c)) ?? winners[winners.length - 1];
  }

  // Sem o naipe: não posso ganhar; guardo os pontos e largo a carta menos útil.
  const nonPoint = legal.filter((c) => !isPointCard(c));
  const pool = nonPoint.length > 0 ? nonPoint : legal;
  return [...pool].sort((a, b) => pWinLeading(ctx, a) - pWinLeading(ctx, b) || strength(a) - strength(b))[0];
}

// ---------------------------------------------------------------------------
// Modo normal: fugir aos pontos
// ---------------------------------------------------------------------------

function chooseLead(ctx: Ctx, legal: Card[], profile: BotProfile): Card {
  const unseenHearts = ctx.unseenBySuit.hearts.length;
  const scored = legal.map((card) => {
    const win = pWinLeading(ctx, card);
    // Custo = hipótese de ficar com a vazada × pontos que lá devem estar.
    let cost = win * (expectedLeadPoints(ctx, card.suit) + cardPoints(card));
    // Copa baixa sem medo: ainda há muitas Copas por sair e é provável que outro fique com a vazada.
    if (
      card.suit === 'hearts' &&
      unseenHearts >= profile.heartsRemainingMin &&
      win <= HEART_LEAD_MAX_WIN_PROB
    ) {
      cost -= profile.heartLeadBonus;
    }
    return { card, cost };
  });
  scored.sort((a, b) => a.cost - b.cost || strength(a.card) - strength(b.card));
  return scored[0].card;
}

function chooseFollow(state: GameState, ctx: Ctx, legal: Card[]): Card {
  const best = winningStrength(state);

  // Último a jogar numa vazada sem pontos: ganhar sai de graça, aproveita para largar uma carta alta.
  const trickPoints = state.currentTrick.reduce((s, p) => s + cardPoints(p.card), 0);
  if (state.currentTrick.length === ctx.numPlayers - 1 && trickPoints === 0) {
    const winners = legal.filter((c) => strength(c) > best);
    if (winners.length > 0) return highest(winners);
  }

  const losing = legal.filter((c) => strength(c) < best);
  if (losing.length > 0) {
    // Se a Dama de Espadas perde (já há um Espada mais alta na mesa), larga-a nos outros.
    const queen = losing.find(isQueenOfSpades);
    if (queen) return queen;
    return highest(losing);
  }

  // Vou ganhar de qualquer forma: gasto a mais alta e guardo as baixas para fugir mais tarde.
  return highest(legal);
}

function chooseDiscard(ctx: Ctx, legal: Card[]): Card {
  const queen = legal.find(isQueenOfSpades);
  if (queen) return queen;

  const hearts = legal.filter((c) => c.suit === 'hearts');
  if (hearts.length > 0) return highest(hearts);

  // Sem pontos para largar: livrar-me da carta mais perigosa.
  const suitCount = (s: Suit) => ctx.hand.filter((c) => c.suit === s).length;
  const danger = (c: Card): number => {
    let d = strength(c);
    const n = suitCount(c.suit);
    if (n === 1) d += 3; // esvaziar um naipe dá liberdade para descartar mais tarde
    else if (n === 2) d += 1;
    // Espadas altas são perigosas enquanto a Dama não sair (posso ser obrigado a apanhá-la).
    if (c.suit === 'spades' && ctx.qsUnseen && strength(c) > STRENGTH.Q) d += 3;
    return d;
  };
  return [...legal].sort((a, b) => danger(b) - danger(a))[0];
}

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

/** Escolhe a jogada do jogador da vez, segundo o perfil dado. Assume que é a vez de um bot. */
export function chooseSmartBotMove(state: GameState, profile: BotProfile = DEFAULT_PROFILE): Card {
  const legal = getLegalMoves(state);
  if (legal.length === 0) {
    throw new Error('O bot não tem jogadas legais (estado inválido).');
  }
  if (legal.length === 1) return legal[0];

  const ctx = buildContext(state);

  if (moonProbability(state, ctx, legal) >= profile.moonThreshold) {
    const move = chooseMoonMove(state, ctx, legal);
    if (move) return move;
  }

  if (state.currentTrick.length === 0) return chooseLead(ctx, legal, profile);

  const following = legal.every((c) => c.suit === state.ledSuit);
  return following ? chooseFollow(state, ctx, legal) : chooseDiscard(ctx, legal);
}
