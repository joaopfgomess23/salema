// ---------------------------------------------------------------------------
// Bot simples (heurístico).
//
// Consome apenas a API pública do motor (getLegalMoves). Não conhece o estado
// interno das regras — só recebe as jogadas legais e escolhe uma sensata.
// É a "versão simples primeiro"; pode ser sofisticada mais tarde sem tocar no motor.
// ---------------------------------------------------------------------------

import {
  GameState,
  Card,
  getLegalMoves,
  STRENGTH,
  isPointCard,
  isQueenOfSpades,
} from '../engine';

const strength = (card: Card): number => STRENGTH[card.rank];
const byStrength = (a: Card, b: Card): number => strength(a) - strength(b);

/** Escolhe a jogada do jogador da vez. Assume que é a vez de um bot. */
export function chooseBotMove(state: GameState): Card {
  const legal = getLegalMoves(state);
  if (legal.length === 0) {
    throw new Error('O bot não tem jogadas legais (estado inválido).');
  }
  if (legal.length === 1) return legal[0];

  const isLeading = state.currentTrick.length === 0;

  if (isLeading) {
    // Abrir: jogar baixo e evitar dar a hipótese de ganhar com pontos.
    const safe = legal.filter((c) => !isPointCard(c));
    const pool = safe.length > 0 ? safe : legal;
    return [...pool].sort(byStrength)[0];
  }

  // A seguir. As jogadas legais são todas do naipe pedido? Então estamos a seguir naipe.
  const followingSuit = legal.every((c) => c.suit === state.ledSuit);

  if (followingSuit) {
    // Força da carta que está a ganhar a vazada (do naipe pedido).
    const winningStrength = Math.max(
      ...state.currentTrick
        .filter((p) => p.card.suit === state.ledSuit)
        .map((p) => strength(p.card)),
    );
    // Cartas que perdem (não tomam a vazada): jogar a mais alta possível em segurança.
    const losing = legal.filter((c) => strength(c) < winningStrength);
    if (losing.length > 0) {
      return [...losing].sort(byStrength).at(-1)!;
    }
    // Vai ganhar de certeza: gastar a carta mais baixa.
    return [...legal].sort(byStrength)[0];
  }

  // A descartar (não tem o naipe): livrar-se do mais perigoso.
  const queen = legal.find(isQueenOfSpades);
  if (queen) return queen;

  const hearts = legal.filter((c) => c.suit === 'hearts');
  if (hearts.length > 0) {
    return [...hearts].sort(byStrength).at(-1)!; // a Copa mais alta
  }

  // Sem pontos para largar: deitar fora a carta mais alta.
  return [...legal].sort(byStrength).at(-1)!;
}
