import pg from 'pg';
import {
  Storage,
  UserRecord,
  UserStats,
  RankingRow,
  MatchPlayerResult,
  toRankingRows,
} from './types';

const { Pool } = pg;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  games_played  INTEGER NOT NULL DEFAULT 0,
  defeats       INTEGER NOT NULL DEFAULT 0,
  total_points  BIGINT  NOT NULL DEFAULT 0,
  salemas       INTEGER NOT NULL DEFAULT 0,
  moons         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/** Persistência em Postgres (produção, ex. Neon). */
export class PostgresStorage implements Storage {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      // Neon e a maioria dos Postgres geridos exigem TLS.
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }

  async init(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async createUser(username: string, passwordHash: string): Promise<UserRecord> {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO users (username, username_lower, password_hash)
         VALUES ($1, $2, $3) RETURNING id, username, password_hash`,
        [username, username.toLowerCase(), passwordHash],
      );
      const r = rows[0];
      return { id: Number(r.id), username: r.username, passwordHash: r.password_hash };
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
        throw new Error('USERNAME_TAKEN');
      }
      throw e;
    }
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, username, password_hash FROM users WHERE username_lower = $1`,
      [username.toLowerCase()],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: Number(r.id), username: r.username, passwordHash: r.password_hash };
  }

  async getById(id: number): Promise<UserRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, username, password_hash FROM users WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: Number(r.id), username: r.username, passwordHash: r.password_hash };
  }

  async recordMatch(results: MatchPlayerResult[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const res of results) {
        await client.query(
          `UPDATE users SET
             games_played = games_played + 1,
             defeats      = defeats + $2,
             total_points = total_points + $3,
             salemas      = salemas + $4,
             moons        = moons + $5
           WHERE id = $1`,
          [res.userId, res.lost ? 1 : 0, res.finalScore, res.salemas, res.moons],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getStats(userId: number): Promise<UserStats | null> {
    const { rows } = await this.pool.query(
      `SELECT username, games_played, defeats, total_points, salemas, moons
       FROM users WHERE id = $1`,
      [userId],
    );
    if (!rows[0]) return null;
    return mapStats(rows[0]);
  }

  async getRanking(limit = 50): Promise<RankingRow[]> {
    const { rows } = await this.pool.query(
      `SELECT username, games_played, defeats, total_points, salemas, moons
       FROM users WHERE games_played > 0`,
    );
    return toRankingRows(rows.map(mapStats)).slice(0, limit);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function mapStats(r: Record<string, unknown>): UserStats {
  return {
    username: String(r.username),
    gamesPlayed: Number(r.games_played),
    defeats: Number(r.defeats),
    totalPoints: Number(r.total_points),
    salemas: Number(r.salemas),
    moons: Number(r.moons),
  };
}
