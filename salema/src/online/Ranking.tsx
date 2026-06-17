import { useEffect, useState } from 'react';
import { HTTP_BASE } from './useAuth';

interface RankingRow {
  rank: number;
  username: string;
  gamesPlayed: number;
  defeats: number;
  winRate: number;
  avgPoints: number;
  salemas: number;
  moons: number;
}

export function Ranking({
  onBack,
  highlight,
}: {
  onBack: () => void;
  highlight?: string;
}) {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${HTTP_BASE}/ranking`);
        const j = await r.json();
        if (alive) setRows(j.ranking || []);
      } catch {
        if (alive) setError('Não foi possível obter a classificação.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="setup">
      <div className="setup__card setup__card--wide">
        <p className="setup__eyebrow">Modo Ranked</p>
        <h1 className="setup__title">Classificação</h1>

        {error && <p className="setup__error">{error}</p>}
        {!rows && !error && <p className="setup__lead">A carregar…</p>}
        {rows && rows.length === 0 && (
          <p className="setup__lead">Ainda não há partidas ranked registadas. Sê o primeiro!</p>
        )}

        {rows && rows.length > 0 && (
          <div className="rank__wrap">
            <table className="rank">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="rank__left">Jogador</th>
                  <th>Vitórias</th>
                  <th>Jogos</th>
                  <th>Derrotas</th>
                  <th>Méd. pts</th>
                  <th title="Damas de espadas (Salemas) apanhadas">Salemas</th>
                  <th title="Luas acertadas">20s</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.username} className={highlight && r.username === highlight ? 'rank__me' : ''}>
                    <td>{r.rank}</td>
                    <td className="rank__left">{r.username}</td>
                    <td>{Math.round(r.winRate * 100)}%</td>
                    <td>{r.gamesPlayed}</td>
                    <td>{r.defeats}</td>
                    <td>{r.avgPoints.toFixed(1)}</td>
                    <td>{r.salemas}</td>
                    <td>{r.moons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="rank__note">
          Ordenado pela taxa de vitórias (jogos em que não chegaste a 100). Só conta o modo Ranked.
        </p>
        <button className="btn-link" onClick={onBack}>← Voltar</button>
      </div>
    </div>
  );
}
