import { useState } from 'react';
import { useOnlineGame } from './useOnlineGame';
import { OnlineTable } from './OnlineTable';

export function OnlineGame({ onExit }: { onExit: () => void }) {
  const game = useOnlineGame();
  const { status, lobby, view, error } = game;

  if (status === 'playing' || status === 'ended') {
    if (!view) return <Centered>A carregar…</Centered>;
    return (
      <>
        <button className="quit" onClick={() => { game.leave(); onExit(); }} title="Sair">
          ✕
        </button>
        <OnlineTable view={view} onPlay={game.play} onLeave={() => { game.leave(); onExit(); }} />
      </>
    );
  }

  if (status === 'lobby' && lobby) {
    return <Lobby lobby={lobby} onStart={game.start} onLeave={() => { game.leave(); onExit(); }} />;
  }

  if (status === 'connecting') {
    return <Centered>A ligar ao servidor…</Centered>;
  }

  // idle / error
  return <Connect onConnect={game.connect} onBack={onExit} error={error} />;
}

function Connect({
  onConnect, onBack, error,
}: {
  onConnect: (name: string) => void; onBack: () => void; error: string | null;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Modo online · jogar com amigos</p>
        <h1 className="setup__title">Salema</h1>
        <p className="setup__lead">
          Entras numa sala pública. Os lugares vazios são preenchidos por bots até dar 5 jogadores.
        </p>
        <label className="setup__label" htmlFor="oname">O teu nome</label>
        <input
          id="oname"
          className="setup__input"
          value={name}
          maxLength={16}
          placeholder="Ex.: Leca"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && trimmed) onConnect(trimmed); }}
          autoFocus
        />
        {error && <p className="setup__error">{error}</p>}
        <button className="btn btn--big" disabled={!trimmed} onClick={() => onConnect(trimmed)}>
          Entrar numa sala
        </button>
        <button className="btn-link" onClick={onBack}>← Voltar</button>
      </div>
    </div>
  );
}

function Lobby({
  lobby, onStart, onLeave,
}: {
  lobby: ReturnType<typeof useOnlineGame>['lobby']; onStart: () => void; onLeave: () => void;
}) {
  if (!lobby) return null;
  const free = 5 - lobby.players.length;
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Sala · à espera de jogadores</p>
        <h1 className="setup__title">Lobby</h1>
        <ul className="lobby__list">
          {lobby.players.map((p, i) => (
            <li key={i} className={i === lobby.yourSeat ? 'lobby__me' : ''}>
              {i + 1}. {p.name}{i === lobby.yourSeat ? ' (tu)' : ''}
            </li>
          ))}
          {Array.from({ length: free }).map((_, i) => (
            <li key={`bot${i}`} className="lobby__bot">{lobby.players.length + i + 1}. (bot)</li>
          ))}
        </ul>
        <p className="setup__lead">
          {lobby.players.length === 1
            ? 'Estás sozinho — podes começar já (4 bots) ou esperar por amigos.'
            : `${lobby.players.length} jogadores na sala.`}
          {free > 0 && ` ${free} ${free === 1 ? 'lugar será preenchido' : 'lugares serão preenchidos'} por bots.`}
        </p>
        <button className="btn btn--big" disabled={!lobby.canStart} onClick={onStart}>
          Começar
        </button>
        <button className="btn-link" onClick={onLeave}>← Sair da sala</button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="setup">
      <div className="setup__card"><p className="setup__lead">{children}</p></div>
    </div>
  );
}
