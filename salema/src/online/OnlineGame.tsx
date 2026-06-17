import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnlineGame, ConnectOptions, RoomInfo } from './useOnlineGame';
import { OnlineTable } from './OnlineTable';
import { useAuth } from './useAuth';
import { AuthForm } from './AuthForm';
import { Ranking } from './Ranking';
import { OnlineHome } from './OnlineHome';
import { GameMode, LobbyView, ChatPayload } from '../shared/protocol';

type Screen = 'menu' | 'auth' | 'rooms' | 'play' | 'ranking';

export function OnlineGame({ onExit }: { onExit: () => void }) {
  const auth = useAuth();
  const game = useOnlineGame();
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('casual');
  const [authThen, setAuthThen] = useState<'menu' | 'rooms'>('menu');

  // Depois de iniciar sessão, segue o destino pretendido.
  useEffect(() => {
    if (screen === 'auth' && auth.status === 'authed') {
      setScreen(authThen === 'rooms' ? 'rooms' : 'menu');
    }
  }, [screen, auth.status, authThen]);

  // Se uma partida for retomada (reconexão/refresh), salta para o ecrã de jogo.
  useEffect(() => {
    if ((game.status === 'playing' || game.status === 'reconnecting') && screen !== 'play') {
      setScreen('play');
    }
  }, [game.status, screen]);

  // Constrói as opções de ligação (nome da conta no casual com sessão; token no ranked).
  const buildOpts = useCallback(
    (typedName?: string): ConnectOptions => {
      if (mode === 'ranked') return { mode: 'ranked', token: auth.token ?? undefined };
      const name = auth.status === 'authed' ? auth.user!.username : (typedName ?? '').trim();
      return { mode: 'casual', name };
    },
    [mode, auth.status, auth.user, auth.token],
  );

  const goRanking = () => setScreen('ranking');

  // ----- ecrãs simples -----
  if (screen === 'ranking') {
    return <Ranking onBack={() => setScreen('menu')} highlight={auth.user?.username} />;
  }

  if (screen === 'auth') {
    return (
      <AuthForm
        auth={auth}
        onBack={() => setScreen('menu')}
        reason={authThen === 'rooms' ? 'O modo Ranked precisa de conta. Entra ou cria uma para continuar.' : undefined}
      />
    );
  }

  if (screen === 'rooms') {
    return (
      <RoomsScreen
        mode={mode}
        needsName={mode === 'casual' && auth.status !== 'authed'}
        fixedName={mode === 'casual' && auth.status === 'authed' ? auth.user!.username : undefined}
        listRooms={game.listRooms}
        error={game.error}
        onCreate={(typedName) => { game.createRoom(buildOpts(typedName)); setScreen('play'); }}
        onJoin={(roomId, typedName) => { game.joinRoom(roomId, buildOpts(typedName)); setScreen('play'); }}
        onBack={() => setScreen('menu')}
      />
    );
  }

  if (screen === 'play') {
    return (
      <PlayScreen
        game={game}
        onExit={() => { game.leave(); auth.refresh(); setScreen('rooms'); }}
      />
    );
  }

  // ----- menu -----
  return (
    <OnlineHome
      auth={auth}
      onCasual={() => { setMode('casual'); setScreen('rooms'); }}
      onRanked={() => {
        setMode('ranked');
        if (auth.status === 'authed') setScreen('rooms');
        else { setAuthThen('rooms'); setScreen('auth'); }
      }}
      onRanking={goRanking}
      onLogin={() => { setAuthThen('menu'); setScreen('auth'); }}
      onBack={onExit}
    />
  );
}

// =========================================================== lista de salas ==

function RoomsScreen({
  mode, needsName, fixedName, listRooms, error, onCreate, onJoin, onBack,
}: {
  mode: GameMode;
  needsName: boolean;
  fixedName?: string;
  listRooms: (m: GameMode) => Promise<RoomInfo[]>;
  error: string | null;
  onCreate: (typedName?: string) => void;
  onJoin: (roomId: string, typedName?: string) => void;
  onBack: () => void;
}) {
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setRooms(await listRooms(mode)); } catch { setRooms([]); }
    setLoading(false);
  }, [mode, listRooms]);

  useEffect(() => { refresh(); }, [refresh]);

  const nameOk = !needsName || name.trim().length >= 2;
  const who = fixedName || (needsName ? name.trim() : '');

  return (
    <div className="setup">
      <div className="setup__card setup__card--wide">
        <p className="setup__eyebrow">{mode === 'ranked' ? 'Ranked' : 'Casual'} · salas</p>
        <h1 className="setup__title">Salas</h1>

        {needsName && (
          <>
            <label className="setup__label" htmlFor="rname">O teu nome</label>
            <input
              id="rname"
              className="setup__input"
              value={name}
              maxLength={16}
              placeholder="Ex.: Leca"
              onChange={(e) => setName(e.target.value)}
            />
          </>
        )}
        {fixedName && (
          <p className="setup__lead">Entras como <strong>{fixedName}</strong>.</p>
        )}

        <button className="btn btn--big" disabled={!nameOk} onClick={() => onCreate(name)}>
          {who ? `Criar lobby — "Lobby do ${who}"` : 'Criar lobby'}
        </button>

        <div className="rooms__head">
          <span>Salas abertas</span>
          <button className="btn-link" onClick={refresh}>↻ Atualizar</button>
        </div>

        {error && <p className="setup__error">{error}</p>}
        {loading && <p className="setup__lead">A procurar salas…</p>}
        {rooms && rooms.length === 0 && !loading && (
          <p className="setup__lead">Não há salas abertas. Cria uma e espera pelos teus amigos!</p>
        )}
        {rooms && rooms.length > 0 && (
          <ul className="rooms__list">
            {rooms.map((r) => (
              <li key={r.roomId} className="roomrow">
                <span className="roomrow__name">Lobby do {r.hostName}</span>
                <span className="roomrow__count">{r.clients}/{r.maxClients}</span>
                <button className="btn btn--sm" disabled={!nameOk} onClick={() => onJoin(r.roomId, name)}>
                  Entrar
                </button>
              </li>
            ))}
          </ul>
        )}

        <button className="btn-link" onClick={onBack}>← Voltar</button>
      </div>
    </div>
  );
}

// =============================================================== ecrã jogo ===

function PlayScreen({
  game, onExit,
}: {
  game: ReturnType<typeof useOnlineGame>;
  onExit: () => void;
}) {
  const { status, lobby, view, error, chat } = game;

  if (status === 'reconnecting') {
    return (
      <div className="setup">
        <div className="setup__card">
          <p className="setup__eyebrow">Ligação</p>
          <h1 className="setup__title">A reconectar…</h1>
          <p className="setup__lead">Perdeste a ligação. A tentar voltar à mesma partida — aguarda um momento.</p>
          <button className="btn-link" onClick={onExit}>← Desistir</button>
        </div>
      </div>
    );
  }

  if (status === 'playing' || status === 'ended') {
    if (!view) return <Centered>A carregar…</Centered>;
    const curName = view.players[view.currentPlayer]?.name ?? '';
    return (
      <>
        <button className="quit" onClick={onExit} title="Sair">✕</button>
        {view.phase === 'playing' && (
          <Countdown endsAt={view.turnEndsAt} yourTurn={view.yourTurn} currentName={curName} />
        )}
        <OnlineTable view={view} onPlay={game.play} onLeave={onExit} />
        <ChatPanel chat={chat} onSend={game.sendChat} yourSeat={view.yourSeat} />
      </>
    );
  }

  if (status === 'lobby' && lobby) {
    return (
      <>
        <WaitingLobby lobby={lobby} onStart={game.start} onLeave={onExit} />
        <ChatPanel chat={chat} onSend={game.sendChat} yourSeat={lobby.yourSeat} />
      </>
    );
  }

  if (status === 'connecting') return <Centered>A ligar ao servidor…</Centered>;

  // error
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Online</p>
        <h1 className="setup__title">Ups</h1>
        <p className="setup__error">{error || 'Algo correu mal.'}</p>
        <button className="btn-link" onClick={onExit}>← Voltar às salas</button>
      </div>
    </div>
  );
}

function WaitingLobby({
  lobby, onStart, onLeave,
}: {
  lobby: LobbyView; onStart: () => void; onLeave: () => void;
}) {
  const ranked = lobby.mode === 'ranked';
  const free = 5 - lobby.players.length;
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">{ranked ? 'Sala Ranqueada' : 'Casual'}</p>
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
          <p className="setup__lead">Começa automaticamente quando entrarem 5 jogadores com sessão iniciada. Sem bots.</p>
        ) : (
          <p className="setup__lead">
            {lobby.players.length === 1
              ? 'Estás sozinho — podes começar já (4 bots) ou esperar por amigos.'
              : `${lobby.players.length} jogadores na sala.`}
            {free > 0 && ` ${free} ${free === 1 ? 'lugar' : 'lugares'} por bots.`}
          </p>
        )}
        {!ranked && (
          <button className="btn btn--big" disabled={!lobby.canStart} onClick={onStart}>Começar</button>
        )}
        <button className="btn-link" onClick={onLeave}>← Sair da sala</button>
      </div>
    </div>
  );
}

// ================================================================ contagem ===

function Countdown({
  endsAt, yourTurn, currentName,
}: {
  endsAt: number | null; yourTurn: boolean; currentName: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!endsAt) return null;
  const secs = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <div className={`turnclock ${yourTurn ? 'turnclock--you' : ''} ${secs <= 3 ? 'turnclock--low' : ''}`}>
      {yourTurn ? `Tens ${secs}s para jogar` : `${currentName} a decidir · ${secs}s`}
    </div>
  );
}

// ==================================================================== chat ===

function ChatPanel({
  chat, onSend, yourSeat,
}: {
  chat: ChatPayload[]; onSend: (t: string) => void; yourSeat: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setSeen(chat.length);
      bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
    }
  }, [chat, open]);

  const unread = chat.length - seen;
  const send = () => { const t = text.trim(); if (t) { onSend(t); setText(''); } };

  if (!open) {
    return (
      <button className="chat__fab" onClick={() => { setOpen(true); setSeen(chat.length); }}>
        💬{unread > 0 && <span className="chat__badge">{unread}</span>}
      </button>
    );
  }

  return (
    <div className="chat">
      <div className="chat__top">
        <span>Chat</span>
        <button className="chat__close" onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="chat__body" ref={bodyRef}>
        {chat.length === 0 && <p className="chat__empty">Sê o primeiro a escrever 👋</p>}
        {chat.map((m, i) => (
          <div key={i} className={`chat__msg ${m.seat === yourSeat ? 'chat__msg--me' : ''}`}>
            <span className="chat__from">{m.from}</span> {m.text}
          </div>
        ))}
      </div>
      <div className="chat__input">
        <input
          value={text}
          maxLength={200}
          placeholder="Escreve…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn btn--sm" onClick={send}>Enviar</button>
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
