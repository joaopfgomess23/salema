import { useState } from 'react';
import { GameTable } from './GameTable';
import { useGame } from './useGame';
import { OnlineGame } from '../online/OnlineGame';

const BOT_NAMES = ['Bummy', 'Pisca', 'Bumaro', 'FF'];

type Screen = 'menu' | 'offline' | 'online';

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [names, setNames] = useState<string[] | null>(null);

  if (screen === 'online') {
    return <OnlineGame onExit={() => setScreen('menu')} />;
  }

  if (screen === 'offline') {
    if (!names) {
      return <Setup onStart={(you) => setNames([you, ...BOT_NAMES])} onBack={() => setScreen('menu')} />;
    }
    return <Game names={names} onQuit={() => { setNames(null); setScreen('menu'); }} />;
  }

  return <Menu onOffline={() => setScreen('offline')} onOnline={() => setScreen('online')} />;
}

function Menu({ onOffline, onOnline }: { onOffline: () => void; onOnline: () => void }) {
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Jogo de vazadas · 5 jogadores</p>
        <h1 className="setup__title">Salema</h1>
        <p className="setup__lead">
          Termina com a menor pontuação. Copas valem 1, a Dama de Espadas — a{' '}
          <strong>Salema</strong> — vale 10. Quem chegar a 100, perde.
        </p>
        <button className="btn btn--big" onClick={onOffline}>
          Jogar offline (vs 4 bots)
        </button>
        <button className="btn btn--big btn--alt" onClick={onOnline}>
          Jogar online (com amigos)
        </button>
        <p className="setup__note">
          Offline joga-se tudo no teu dispositivo. Online liga-se a um servidor e regista estatísticas.
        </p>
      </div>
    </div>
  );
}

function Setup({ onStart, onBack }: { onStart: (you: string) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Modo offline · 1 humano + 4 bots</p>
        <h1 className="setup__title">Salema</h1>
        <p className="setup__lead">
          Termina com a menor pontuação. Copas valem 1, a Dama de Espadas — a{' '}
          <strong>Salema</strong> — vale 10. Quem chegar a 100, perde.
        </p>
        <label className="setup__label" htmlFor="name">O teu nome</label>
        <input
          id="name"
          className="setup__input"
          value={name}
          maxLength={16}
          placeholder="Ex.: Bummy"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && trimmed) onStart(trimmed); }}
          autoFocus
        />
        <button className="btn btn--big" disabled={!trimmed} onClick={() => onStart(trimmed)}>
          Jogar contra 4 bots
        </button>
        <button className="btn-link" onClick={onBack}>← Voltar</button>
      </div>
    </div>
  );
}

function Game({ names, onQuit }: { names: string[]; onQuit: () => void }) {
  const game = useGame(names);
  return (
    <>
      <button className="quit" onClick={onQuit} title="Sair">✕</button>
      <GameTable game={game} />
    </>
  );
}
