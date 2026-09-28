// ---------------------------------------------------------------------------
// Os 10 bots disponíveis e o sorteio.
//
// Os nomes são só de apresentação: podes trocá-los à vontade (o "id" é que
// identifica o bot). Os parâmetros definem a personalidade:
//
//  - moonThreshold      probabilidade mínima para tentar apanhar os 20 pontos
//                       (mais baixo = tenta mais vezes = mais agressivo)
//  - heartsRemainingMin nº de Copas por sair a partir do qual abre com Copa baixa
//                       (mais baixo = mais atrevido)
//  - heartLeadBonus     quanto lhe agrada abrir com Copa baixa
//                       (mais alto = mais atrevido)
// ---------------------------------------------------------------------------

import type { BotProfile } from './smartBot';

export const BOT_ROSTER: BotProfile[] = [
  // ---- Cautelosos ----
  { id: 1, name: 'Pisca', style: 'muito cauteloso', moonThreshold: 0.85, heartsRemainingMin: 7, heartLeadBonus: 0.15 },
  { id: 2, name: 'Costa', style: 'cauteloso', moonThreshold: 0.78, heartsRemainingMin: 6, heartLeadBonus: 0.3 },
  { id: 3, name: 'Cota', style: 'cauteloso', moonThreshold: 0.72, heartsRemainingMin: 6, heartLeadBonus: 0.45 },
  // ---- Equilibrados (o Bot 5 é a base: 63%) ----
  { id: 4, name: 'Bummy', style: 'equilibrado', moonThreshold: 0.66, heartsRemainingMin: 5, heartLeadBonus: 0.6 },
  { id: 5, name: 'Pintor', style: 'equilibrado', moonThreshold: 0.63, heartsRemainingMin: 5, heartLeadBonus: 0.6 },
  { id: 6, name: 'Pedro', style: 'equilibrado', moonThreshold: 0.6, heartsRemainingMin: 5, heartLeadBonus: 0.75 },
  // ---- Agressivos ----
  { id: 7, name: 'Bumaro', style: 'arrojado', moonThreshold: 0.55, heartsRemainingMin: 4, heartLeadBonus: 0.9 },
  { id: 8, name: 'Pais', style: 'agressivo', moonThreshold: 0.5, heartsRemainingMin: 4, heartLeadBonus: 1.0 },
  { id: 9, name: 'Hugo', style: 'agressivo', moonThreshold: 0.45, heartsRemainingMin: 3, heartLeadBonus: 1.2 },
  { id: 10, name: 'FF', style: 'muito agressivo', moonThreshold: 0.4, heartsRemainingMin: 3, heartLeadBonus: 1.4 },
];

/** Sorteia `count` bots diferentes (sem repetir). */
export function pickBots(count: number, random: () => number = Math.random): BotProfile[] {
  if (count > BOT_ROSTER.length) {
    throw new Error(`Só existem ${BOT_ROSTER.length} bots.`);
  }
  const pool = BOT_ROSTER.slice();
  // Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
