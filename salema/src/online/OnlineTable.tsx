import { useState } from 'react';
import { Suit, Rank, cardId } from '../engine';
import { CardView } from '../ui/CardView';
import {
  GameView,
  CardData,
  TrickPlayView,
  CompletedTrickView,
} from '../shared/protocol';

// Geometria dos 5 lugares (posição 0 = em baixo = tu).
const SEAT_POS: React.CSSProperties[] = [
  { bottom: '1%', left: '50%', transform: 'translateX(-50%)' },
  { bottom: '20%', left: '1.5%' },
  { top: '4%', left: '12%' },
  { top: '4%', right: '12%' },
  { bottom: '20%', right: '1.5%' },
];
const TRICK_POS: React.CSSProperties[] = [
  { bottom: '26%', left: '50%', transform: 'translateX(-50%)' },
  { bottom: '40%', left: '30%' },
  { top: '34%', left: '38%' },
  { top: '34%', right: '38%' },
  { bottom: '40%', right: '30%' },
];

const toCard = (c: CardData) => ({ suit: c.suit as Suit, rank: c.rank as Rank });

export function OnlineTable({ view, onPlay, onLeave }: {
  view: GameView;
  onPlay: (cardId: string) => void;
  onLeave: () => void;
}) {
  const me = view.yourSeat;
  const screen = (seat: number) => (seat - me + 5) % 5; // roda para te pôr em baixo

  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const completed = view.completedTricks;
  const peeking = peekIndex !== null && completed[peekIndex] !== undefined;

  // O que mostrar ao centro
  const shownTrick: CompletedTrickView | undefined = peeking
    ? completed[peekIndex as number]
    : view.paused
      ? completed[completed.length - 1]
      : undefined;
  const centrePlays: TrickPlayView[] = shownTrick ? shownTrick.plays : view.currentTrick;
  const winnerSeat = shownTrick ? shownTrick.winner : null;
  const frozen = view.paused || peeking;

  const legal = new Set(view.legalCardIds);
  const canPlay = view.yourTurn && !peeking;
  const canPeek = completed.length > 0 && !peeking && view.phase === 'playing';

  const showHandOverlay = view.phase === 'handComplete' && !view.paused && !peeking;
  const showMatchOverlay = view.phase === 'matchComplete' && !peeking;

  const nameOf = (seat: number) => (seat === me ? 'Tu' : view.players[seat].name);

  return (
    <div className="game">
      <StatusBar view={view} peeking={peeking} />

      <div className="table">
        <div className="table__felt" />

        {view.players.map((p, seat) => (
          <Seat
            key={seat}
            label={seat === me ? 'Tu' : p.name}
            isBot={p.isBot}
            connected={p.connected}
            score={p.score}
            handPoints={p.handPoints}
            cardsLeft={p.cardsLeft}
            isYou={seat === me}
            pos={SEAT_POS[screen(seat)]}
            isCurrent={view.phase === 'playing' && view.currentPlayer === seat && !frozen}
            isWinner={winnerSeat === seat}
          />
        ))}

        {centrePlays.map((pl) => (
          <div className="trickcard" key={pl.player} style={TRICK_POS[screen(pl.player)]}>
            <CardView card={toCard(pl.card)} size="md" />
            {winnerSeat === pl.player && <span className="trickcard__won">ganhou</span>}
          </div>
        ))}
      </div>

      {canPeek && (
        <button className="peekbtn" onClick={() => setPeekIndex(completed.length - 1)}>
          ↩ Ver vazada anterior
        </button>
      )}

      {peeking && shownTrick && (
        <div className="review">
          <div className="review__info">
            A rever — Vazada {(peekIndex as number) + 1}/8 · ganhou {nameOf(shownTrick.winner)}
          </div>
          <div className="review__btns">
            <button
              className="btn-ghost"
              onClick={() => setPeekIndex((i) => Math.max(0, (i as number) - 1))}
              disabled={(peekIndex as number) <= 0}
            >
              ◀ Anterior
            </button>
            <button
              className="btn-ghost"
              onClick={() => setPeekIndex((i) => Math.min(completed.length - 1, (i as number) + 1))}
              disabled={(peekIndex as number) >= completed.length - 1}
            >
              Seguinte ▶
            </button>
            <button className="btn-pill" onClick={() => setPeekIndex(null)}>
              Voltar ao jogo
            </button>
          </div>
        </div>
      )}

      <div className="hand">
        {view.hand.map((c) => {
          const card = toCard(c);
          const id = cardId(card);
          const playable = canPlay && legal.has(id);
          const dimmed = canPlay && !legal.has(id);
          return (
            <CardView
              key={id}
              card={card}
              size="lg"
              highlight={playable}
              dimmed={dimmed}
              onClick={playable ? () => onPlay(id) : undefined}
            />
          );
        })}
      </div>

      {showHandOverlay && <HandOverlay view={view} />}
      {showMatchOverlay && <MatchOverlay view={view} onLeave={onLeave} />}
    </div>
  );
}

function StatusBar({ view, peeking }: { view: GameView; peeking: boolean }) {
  let message: string;
  if (peeking) message = 'A rever vazadas anteriores';
  else if (view.paused) message = 'Fim da vazada…';
  else if (view.phase === 'matchComplete') message = 'Fim de jogo';
  else if (view.phase === 'handComplete') message = 'Fim da mão';
  else if (view.yourTurn) message = 'A tua vez — escolhe uma carta';
  else message = `Vez de ${view.players[view.currentPlayer].name}…`;

  return (
    <div className="status">
      <span className="status__msg">{message}</span>
      <span className="status__meta">
        Mão {view.handNumber} · Vazada {Math.min(view.trickNumber, 8)}/8
        {view.heartsBroken ? ' · Copas quebradas' : ''}
      </span>
    </div>
  );
}

function Seat({
  label, isBot, connected, score, handPoints, cardsLeft, isYou, pos, isCurrent, isWinner,
}: {
  label: string; isBot: boolean; connected: boolean; score: number; handPoints: number;
  cardsLeft: number; isYou: boolean; pos: React.CSSProperties; isCurrent: boolean; isWinner: boolean;
}) {
  const classes = ['seat', isCurrent ? 'seat--current' : '', isWinner ? 'seat--winner' : '']
    .filter(Boolean).join(' ');
  return (
    <div className={classes} style={pos}>
      <div className="seat__name">
        {label}
        {isBot && <span className="seat__tag"> bot</span>}
        {!isBot && !connected && <span className="seat__tag"> saiu</span>}
      </div>
      <div className="seat__score">
        {score} pts{handPoints > 0 && <span className="seat__hand"> (+{handPoints})</span>}
      </div>
      {!isYou && cardsLeft > 0 && (
        <div className="seat__backs">
          <CardView faceDown size="sm" />
          <span className="seat__count">{cardsLeft}</span>
        </div>
      )}
    </div>
  );
}

function HandOverlay({ view }: { view: GameView }) {
  const r = view.lastHandResult;
  if (!r) return null;
  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="panel__title">Fim da mão {view.handNumber}</h2>
        {r.moonShooter !== null && (
          <p className="panel__moon">
            🌙 {view.players[r.moonShooter].name} acertou na lua! Leva 0; os outros levam 20.
          </p>
        )}
        <table className="scoretable">
          <thead><tr><th>Jogador</th><th>Esta mão</th><th>Total</th></tr></thead>
          <tbody>
            {view.players.map((p, i) => (
              <tr key={i}>
                <td>{i === view.yourSeat ? 'Tu' : p.name}</td>
                <td>+{r.appliedPoints[i]}</td>
                <td>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="panel__hint">A próxima mão começa em instantes…</p>
      </div>
    </div>
  );
}

function MatchOverlay({ view, onLeave }: { view: GameView; onLeave: () => void }) {
  const losers = view.losers ?? [];
  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="panel__title">Fim de jogo</h2>
        <p className="panel__losers">
          {losers.length === 1 ? 'Perdeu: ' : 'Perderam: '}
          {losers.map((i) => (i === view.yourSeat ? 'Tu' : view.players[i].name)).join(', ')}
        </p>
        <table className="scoretable">
          <thead><tr><th>Jogador</th><th>Total</th></tr></thead>
          <tbody>
            {view.players
              .map((p, i) => ({ name: i === view.yourSeat ? 'Tu' : p.name, score: p.score, i }))
              .sort((a, b) => a.score - b.score)
              .map(({ name, score, i }) => (
                <tr key={i} className={losers.includes(i) ? 'row--loser' : ''}>
                  <td>{name}</td>
                  <td>{score}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <button className="btn" onClick={onLeave}>Voltar ao início</button>
      </div>
    </div>
  );
}
