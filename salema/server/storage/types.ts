// ---------------------------------------------------------------------------
// Porta de persistência (hexagonal). O servidor depende desta interface, não
// de uma base de dados concreta. Há duas implementações: em memória (dev/testes)
// e Postgres (produção, ex. Neon).
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: number;
  username: string;
  passwordHash: string;
}

export interface UserStats {
  username: string;
  gamesPlayed: number;
  defeats: number;
  totalPoints: number;
  salemas: number;
  moons: number;
}

export interface RankingRow extends UserStats {
  rank: number;
  winRate: number; // (gamesPlayed - defeats) / gamesPlayed  (0..1)
  avgPoints: number; // totalPoints / gamesPlayed
}

/** Resultado de UM jogador numa partida ranked terminada. */
export interface MatchPlayerResult {
  userId: number;
  finalScore: number;
  lost: boolean; // chegou a 100 (perdeu)
  salemas: number; // nº de Q♠ apanhadas nesta partida
  moons: number; // nº de luas que acertou nesta partida
}

export interface Storage {
  /** Cria o esquema, se necessário. */
  init(): Promise<void>;
  createUser(username: string, passwordHash: string): Promise<UserRecord>;
  /** Procura por nome (sem distinguir maiúsculas/minúsculas). */
  findByUsername(username: string): Promise<UserRecord | null>;
  getById(id: number): Promise<UserRecord | null>;
  /** Regista o resultado de uma partida ranked (atualiza agregados, em transação). */
  recordMatch(results: MatchPlayerResult[]): Promise<void>;
  getStats(userId: number): Promise<UserStats | null>;
  getRanking(limit?: number): Promise<RankingRow[]>;
  close(): Promise<void>;
}

/** Calcula as colunas derivadas do ranking a partir dos agregados. */
export function toRankingRows(
  rows: Array<UserStats>,
): RankingRow[] {
  return rows
    .filter((r) => r.gamesPlayed > 0)
    .map((r) => ({
      ...r,
      winRate: (r.gamesPlayed - r.defeats) / r.gamesPlayed,
      avgPoints: r.totalPoints / r.gamesPlayed,
    }))
    .sort((a, b) => b.winRate - a.winRate || a.avgPoints - b.avgPoints)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
