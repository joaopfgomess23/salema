// ---------------------------------------------------------------------------
// Gerador de números pseudo-aleatórios determinístico (mulberry32).
//
// É puro: dado um estado, devolve sempre o mesmo resultado e o próximo estado.
// Isto torna a distribuição de cartas reproduzível nos testes.
// ---------------------------------------------------------------------------

/** Devolve [valor em [0,1), próximo estado]. */
export function nextRandom(state: number): [number, number] {
  let a = state | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, a];
}

/** Baralha uma cópia do array (Fisher–Yates). Devolve [baralhado, próximo estado]. */
export function shuffle<T>(arr: T[], state: number): [T[], number] {
  const a = arr.slice();
  let s = state;
  for (let i = a.length - 1; i > 0; i--) {
    let r: number;
    [r, s] = nextRandom(s);
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return [a, s];
}

/** Semente aleatória inicial (usada quando o jogo não recebe uma semente fixa). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) | 0 || 1;
}
