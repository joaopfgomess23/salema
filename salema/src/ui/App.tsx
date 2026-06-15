import { useState } from 'react';
import { GameTable } from './GameTable';
import { useGame } from './useGame';

const BOT_NAMES = ['Bummy', 'Pisca', 'Bumaro', 'FF'];

export function App() {
  const [names, setNames] = useState<string[] | null>(null);

  if (!names) {
    return <Setup onStart={(you) => setNames([you, ...BOT_NAMES])} />;
  }
  return <Game names={names} onQuit={() => setNames(null)} />;
}

function Setup({ onStart }: { onStart: (you: string) => void }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <div className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">Jogo de vazadas · 5 jogadores</p>
        <h1 className="setup__title">Salema</h1>
        <p className="setup__lead">
          Termina com a menor pontuação. Copas valem 1, a Dama de Espadas — a{' '}
          <strong>Salema</strong> — vale 10. Quem chegar a 100, perde.
        </p>
        <label className="setup__label" htmlFor="name">
          O teu nome
        </label>
        <input
          id="name"
          className="setup__input"
          value={name}
          maxLength={16}
          placeholder="Ex.: Bummy"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && trimmed) onStart(trimmed);
          }}
          autoFocus
        />
        <button className="btn btn--big" disabled={!trimmed} onClick={() => onStart(trimmed)}>
          Jogar contra 4 bots
        </button>
        <p className="setup__note">Modo offline — joga-se tudo no teu dispositivo.</p>
      </div>
    </div>
  );
}

function Game({ names, onQuit }: { names: string[]; onQuit: () => void }) {
  const game = useGame(names);
  return (
    <>
      <button className="quit" onClick={onQuit} title="Sair">
        ✕
      </button>
      <GameTable game={game} />
    </>
  );
}
