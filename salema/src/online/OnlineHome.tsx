import { UseAuth } from './useAuth';

export function OnlineHome({
  auth,
  onCasual,
  onRanked,
  onRanking,
  onLogin,
  onBack,
}: {
  auth: UseAuth;
  onCasual: () => void;
  onRanked: () => void;
  onRanking: () => void;
  onLogin: () => void;
  onBack: () => void;
}) {
  const { status, user, stats } = auth;

  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Modo online</p>
        <h1 className="setup__title">Salema</h1>

        <div className="account">
          {status === 'authed' && user ? (
            <>
              <div className="account__row">
                <span className="account__hi">Sessão iniciada como <strong>{user.username}</strong></span>
                <button className="btn-link account__out" onClick={auth.logout}>Terminar sessão</button>
              </div>
              {stats && stats.gamesPlayed > 0 && (
                <p className="account__stats">
                  {stats.gamesPlayed} jogos · {stats.gamesPlayed - stats.defeats} vitórias ·{' '}
                  {stats.salemas} salemas · {stats.moons} 20s
                </p>
              )}
              {stats && stats.gamesPlayed === 0 && (
                <p className="account__stats">Ainda sem partidas ranked.</p>
              )}
            </>
          ) : status === 'loading' ? (
            <p className="account__stats">A verificar sessão…</p>
          ) : (
            <div className="account__row">
              <span className="account__hi">Sem sessão iniciada</span>
              <button className="btn-link" onClick={onLogin}>Entrar / Criar conta</button>
            </div>
          )}
        </div>

        <div className="home__modes">
          <button className="modecard" onClick={onCasual}>
            <span className="modecard__title">Casual</span>
            <span className="modecard__desc">
              Entra já. Os lugares vazios são preenchidos por bots. Não conta para estatísticas.
            </span>
          </button>

          <button className="modecard modecard--ranked" onClick={onRanked}>
            <span className="modecard__title">Ranked</span>
            <span className="modecard__desc">
              5 jogadores reais com sessão iniciada, sem bots. Só este modo conta para o ranking.
            </span>
          </button>

          <button className="modecard modecard--ghost" onClick={onRanking}>
            <span className="modecard__title">Classificação</span>
            <span className="modecard__desc">Vê a tabela de ranking dos jogadores.</span>
          </button>
        </div>

        <button className="btn-link" onClick={onBack}>← Voltar ao início</button>
      </div>
    </div>
  );
}
