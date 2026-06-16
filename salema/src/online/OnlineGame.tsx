import { useEffect, useRef, useState } from 'react';
import { useOnlineGame } from './useOnlineGame';
import { OnlineTable } from './OnlineTable';
import { useAuth, UseAuth } from './useAuth';
import { AuthForm } from './AuthForm';
import { Ranking } from './Ranking';
import { OnlineHome } from './OnlineHome';
import { GameMode, LobbyView } from '../shared/protocol';

type Screen = 'menu' | 'auth' | 'play' | 'ranking';

export function OnlineGame({ onExit }: { onExit: () => void }) {
  const auth = useAuth();
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('casual');
  const [authThen, setAuthThen] = useState<'menu' | 'ranked'>('menu');

  // Depois de iniciar sessão, segue o destino pretendido.
  useEffect(() => {
    if (screen === 'auth' && auth.status === 'authed') {
      if (authThen === 'ranked') {
        setMode('ranked');
        setScreen('play');
      } else {
        setScreen('menu');
      }
    }
  }, [screen, auth.status, authThen]);

  if (screen === 'ranking') {
    return <Ranking onBack={() => setScreen('menu')} highlight={auth.user?.username} />;
  }

  if (screen === 'auth') {
    return (
      <AuthForm
        auth={auth}
        onBack={() => setScreen('menu')}
        reason={
          authThen === 'ranked'
            ? 'O modo Ranked precisa de conta. Entra ou cria uma para continuar.'
            : undefined
        }
      />
    );
  }

  if (screen === 'play') {
    return (
      <PlayFlow
        mode={mode}
        auth={auth}
        onExit={() => {
          setScreen('menu');
          auth.refresh();
        }}
      />
    );
  }

  return (
    <OnlineHome
      auth={auth}
      onCasual={() => {
        setMode('casual');
        setScreen('play');
      }}
      onRanked={() => {
        if (auth.status === 'authed') {
          setMode('ranked');
          setScreen('play');
        } else {
          setAuthThen('ranked');
          setScreen('auth');
        }
      }}
      onRanking={() => setScreen('ranking')}
      onLogin={() => {
        setAuthThen('menu');
        setScreen('auth');
      }}
      onBack={onExit}
    />
  );
}

// --------------------------------------------------------------- play flow --

function PlayFlow({
  mode,
  auth,
  onExit,
}: {
  mode: GameMode;
  auth: UseAuth;
  onExit: () => void;
}) {
  const game = useOnlineGame();
  const { status, lobby, view, error } = game;
  const connectedRef = useRef(false);

  // Ranked: liga automaticamente com o token quando autenticado.
  useEffect(() => {
    if (
      mode === 'ranked' &&
      auth.status === 'authed' &&
      auth.token &&
      status === 'idle' &&
      !connectedRef.current
    ) {
      connectedRef.current = true;
      game.connect({ mode: 'ranked', token: auth.token });
    }
  }, [mode, auth.status, auth.token, status, game]);

  // Atualiza estatísticas quando uma partida ranked termina.
  useEffect(() => {
    if (mode === 'ranked' && status === 'ended') auth.refresh();
  }, [mode, status, auth]);

  const exit = () => {
    game.leave();
    onExit();
  };

  if (status === 'playing' || status === 'ended') {
    if (!view) return <Centered>A carregar…</Centered>;
    return (
      <>
        <button className="quit" onClick={exit} title="Sair">✕</button>
        <OnlineTable view={view} onPlay={game.play} onLeave={exit} />
      </>
    );
  }

  if (status === 'lobby' && lobby) {
    return <Lobby lobby={lobby} onStart={game.start} onLeave={exit} />;
  }

  if (status === 'connecting') {
    return <Centered>A ligar ao servidor…</Centered>;
  }

  // idle / error
  if (mode === 'casual') {
    return (
      <ConnectCasual
        onConnect={(name) => game.connect({ mode: 'casual', name })}
        onBack={onExit}
        error={error}
      />
    );
  }

  // ranked idle/error
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Modo Ranked</p>
        <h1 className="setup__title">{error ? 'Ups' : 'A entrar…'}</h1>
        <p className={error ? 'setup__error' : 'setup__lead'}>
          {error || 'A entrar na sala ranqueada…'}
        </p>
        <button className="btn-link" onClick={onExit}>← Voltar</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pieces --

function ConnectCasual({
  onConnect,
  onBack,
  error,
}: {
  onConnect: (name: string) => void;
  onBack: () => void;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Online · Casual</p>
        <h1 className="setup__title">Salema</h1>
        <p className="setup__lead">
          Entras numa sala pública. Os lugares vazios são preenchidos por bots até dar 5 jogadores.
          Este modo não conta para estatísticas.
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
  lobby,
  onStart,
  onLeave,
}: {
  lobby: LobbyView;
  onStart: () => void;
  onLeave: () => void;
}) {
  const ranked = lobby.mode === 'ranked';
  const free = 5 - lobby.players.length;
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">{ranked ? 'Sala Ranqueada' : 'Online · Casual'}</p>
        <h1 className="setup__title">{ranked ? `À espera (${lobby.players.length}/5)` : 'Lobby'}</h1>
        <ul className="lobby__list">
          {lobby.players.map((p, i) => (
            <li key={i} className={i === lobby.yourSeat ? 'lobby__me' : ''}>
              {i + 1}. {p.name}{i === lobby.yourSeat ? ' (tu)' : ''}
            </li>
          ))}
          {Array.from({ length: free }).map((_, i) => (
            <li key={`f${i}`} className="lobby__bot">
              {lobby.players.length + i + 1}. {ranked ? '(à espera…)' : '(bot)'}
            </li>
          ))}
        </ul>
        {ranked ? (
          <p className="setup__lead">
            O jogo começa automaticamente quando entrarem 5 jogadores com sessão iniciada. Sem bots.
          </p>
        ) : (
          <p className="setup__lead">
            {lobby.players.length === 1
              ? 'Estás sozinho — podes começar já (4 bots) ou esperar por amigos.'
              : `${lobby.players.length} jogadores na sala.`}
            {free > 0 && ` ${free} ${free === 1 ? 'lugar será preenchido' : 'lugares serão preenchidos'} por bots.`}
          </p>
        )}
        {!ranked && (
          <button className="btn btn--big" disabled={!lobby.canStart} onClick={onStart}>
            Começar
          </button>
        )}
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
