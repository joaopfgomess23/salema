import {
  Storage,
  UserRecord,
  UserStats,
  RankingRow,
  MatchPlayerResult,
  toRankingRows,
} from './types';

interface Row extends UserRecord, Omit<UserStats, 'username'> {}

/** Persistência em memória — usada em desenvolvimento e nos testes. */
export class MemoryStorage implements Storage {
  private byId = new Map<number, Row>();
  private byLower = new Map<string, number>();
  private nextId = 1;

  async init(): Promise<void> {
    /* nada a fazer */
  }

  async createUser(username: string, passwordHash: string): Promise<UserRecord> {
    const lower = username.toLowerCase();
    if (this.byLower.has(lower)) {
      throw new Error('USERNAME_TAKEN');
    }
    const row: Row = {
      id: this.nextId++,
      username,
      passwordHash,
      gamesPlayed: 0,
      defeats: 0,
      totalPoints: 0,
      salemas: 0,
      moons: 0,
    };
    this.byId.set(row.id, row);
    this.byLower.set(lower, row.id);
    return { id: row.id, username: row.username, passwordHash: row.passwordHash };
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const id = this.byLower.get(username.toLowerCase());
    if (id === undefined) return null;
    const r = this.byId.get(id)!;
    return { id: r.id, username: r.username, passwordHash: r.passwordHash };
  }

  async getById(id: number): Promise<UserRecord | null> {
    const r = this.byId.get(id);
    return r ? { id: r.id, username: r.username, passwordHash: r.passwordHash } : null;
  }

  async recordMatch(results: MatchPlayerResult[]): Promise<void> {
    for (const res of results) {
      const r = this.byId.get(res.userId);
      if (!r) continue;
      r.gamesPlayed += 1;
      r.defeats += res.lost ? 1 : 0;
      r.totalPoints += res.finalScore;
      r.salemas += res.salemas;
      r.moons += res.moons;
    }
  }

  async getStats(userId: number): Promise<UserStats | null> {
    const r = this.byId.get(userId);
    if (!r) return null;
    return {
      username: r.username,
      gamesPlayed: r.gamesPlayed,
      defeats: r.defeats,
      totalPoints: r.totalPoints,
      salemas: r.salemas,
      moons: r.moons,
    };
  }

  async getRanking(limit = 50): Promise<RankingRow[]> {
    const rows: UserStats[] = [...this.byId.values()].map((r) => ({
      username: r.username,
      gamesPlayed: r.gamesPlayed,
      defeats: r.defeats,
      totalPoints: r.totalPoints,
      salemas: r.salemas,
      moons: r.moons,
    }));
    return toRankingRows(rows).slice(0, limit);
  }

  async close(): Promise<void> {
    /* nada a fazer */
  }
}
