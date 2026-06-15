import { GameState, TrickPlay, cardId, sortHand, handPointsSoFar } from '../engine';
import { CardView } from './CardView';
import { HUMAN, UseGame } from './useGame';

// Geometria dos 5 lugares à volta da mesa (sentido horário a partir de baixo).
const SEAT_POS: React.CSSProperties[] = [
  { bottom: '1%', left: '50%', transform: 'translateX(-50%)' }, // 0 - tu
  { bottom: '20%', left: '1.5%' }, // 1
  { top: '4%', left: '12%' }, // 2
  { top: '4%', right: '12%' }, // 3
  { bottom: '20%', right: '1.5%' }, // 4
];

// Posição da carta jogada por cada lugar, puxada para o centro.
const TRICK_POS: React.CSSProperties[] = [
  { bottom: '26%', left: '50%', transform: 'translateX(-50%)' },
  { bottom: '40%', left: '30%' },
  { top: '34%', left: '38%' },
  { top: '34%', right: '38%' },
  { bottom: '40%', right: '30%' },
];

export function GameTable({ game }: { game: UseGame }) {
  const {
    state,
    waiting,
    peeking,
    peekIndex,
    canPeek,
    canPeekPrev,
    canPeekNext,
    isHumanTurn,
    legalIds,
    showHandOverlay,
    showMatchOverlay,
    playHuman,
    advanceTrick,
    openPeek,
    closePeek,
    peekPrev,
    peekNext,
    nextHand,
    restart,
  } = game;

  // O que mostrar ao centro: revisão > pausa de fim de vazada > vazada em curso.
  const shownTrick = peeking
    ? state.completedTricks[peekIndex]
    : waiting
      ? state.completedTricks[state.completedTricks.length - 1]
      : undefined;
  const centrePlays: TrickPlay[] = shownTrick ? shownTrick.plays : state.currentTrick;
  const winnerSeat = shownTrick ? shownTrick.winner : null;
  const frozen = waiting || peeking;

  return (
    <div className="game">
      <StatusBar
        state={state}
        isHumanTurn={isHumanTurn}
        waiting={waiting}
        peeking={peeking}
        peekIndex={peekIndex}
      />

      <div className="table">
        <div className="table__felt" />

        {/* Lugares */}
        {state.players.map((name, i) => (
          <Seat
            key={i}
            name={i === HUMAN ? 'Tu' : name}
            seat={i}
            state={state}
            isCurrent={state.phase === 'playing' && state.currentPlayer === i && !frozen}
            isWinner={winnerSeat === i}
          />
        ))}

        {/* Cartas ao centro */}
        {centrePlays.map((p) => (
          <div className="trickcard" key={p.player} style={TRICK_POS[p.player]}>
            <CardView card={p.card} size="md" />
            {winnerSeat === p.player && <span className="trickcard__won">ganhou</span>}
          </div>
        ))}
      </div>

      {/* Botão sempre disponível para rever vazadas anteriores */}
      {canPeek && !peeking && (
        <button className="peekbtn" onClick={openPeek}>
          ↩ Ver vazada anterior
        </button>
      )}

      {/* Barra de controlo: revisão (sempre) ou fim de vazada (próxima vazada) */}
      {peeking && shownTrick && (
        <ControlBar
          label={`A rever — Vazada ${peekIndex + 1}/8 · ganhou ${nameOf(state, shownTrick.winner)}`}
        >
          <button className="btn-ghost" onClick={peekPrev} disabled={!canPeekPrev}>
            ◀ Anterior
          </button>
          <button className="btn-ghost" onClick={peekNext} disabled={!canPeekNext}>
            Seguinte ▶
          </button>
          <button className="btn-pill" onClick={closePeek}>
            Voltar ao jogo
          </button>
        </ControlBar>
      )}

      {waiting && !peeking && shownTrick && (
        <ControlBar
          label={`Fim da vazada ${state.completedTricks.length}/8 · ganhou ${nameOf(
            state,
            shownTrick.winner,
          )}`}
        >
          <button className="btn-pill" onClick={advanceTrick}>
            {state.phase === 'playing'
              ? 'Próxima vazada ▶'
              : state.phase === 'handComplete'
                ? 'Ver resultado da mão ▶'
                : 'Ver resultado final ▶'}
          </button>
        </ControlBar>
      )}

      {/* A tua mão */}
      <YourHand state={state} isHumanTurn={isHumanTurn} legalIds={legalIds} onPlay={playHuman} />

      {/* Sobreposições */}
      {showHandOverlay && <HandOverlay state={state} onContinue={nextHand} />}
      {showMatchOverlay && <MatchOverlay state={state} onRestart={restart} />}
    </div>
  );
}

function nameOf(state: GameState, seat: number): string {
  return seat === HUMAN ? 'Tu' : state.players[seat];
}

function ControlBar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="review">
      <div className="review__info">{label}</div>
      <div className="review__btns">{children}</div>
    </div>
  );
}

function StatusBar({
  state,
  isHumanTurn,
  waiting,
  peeking,
  peekIndex,
}: {
  state: GameState;
  isHumanTurn: boolean;
  waiting: boolean;
  peeking: boolean;
  peekIndex: number;
}) {
  let message: string;
  if (peeking) message = 'A rever vazadas anteriores';
  else if (waiting) message = 'Fim da vazada — vê as cartas e avança';
  else if (state.phase === 'matchComplete') message = 'Fim de jogo';
  else if (state.phase === 'handComplete') message = 'Fim da mão';
  else if (isHumanTurn) message = 'A tua vez — escolhe uma carta';
  else message = `Vez de ${state.players[state.currentPlayer]}…`;

  const trickShown = peeking
    ? peekIndex + 1
    : waiting
      ? state.completedTricks.length
      : Math.min(state.trickNumber, 8);

  return (
    <div className="status">
      <span className="status__msg">{message}</span>
      <span className="status__meta">
        Mão {state.handNumber} · Vazada {trickShown}/8
        {state.heartsBroken ? ' · Copas quebradas' : ''}
      </span>
    </div>
  );
}

function Seat({
  name,
  seat,
  state,
  isCurrent,
  isWinner,
}: {
  name: string;
  seat: number;
  state: GameState;
  isCurrent: boolean;
  isWinner: boolean;
}) {
  const cardsLeft = state.hands[seat].length;
  const handPts = handPointsSoFar(state, seat);
  const classes = ['seat', isCurrent ? 'seat--current' : '', isWinner ? 'seat--winner' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={SEAT_POS[seat]}>
      <div className="seat__name">{name}</div>
      <div className="seat__score">
        {state.scores[seat]} pts
        {handPts > 0 && <span className="seat__hand"> (+{handPts})</span>}
      </div>
      {seat !== HUMAN && cardsLeft > 0 && (
        <div className="seat__backs">
          <CardView faceDown size="sm" />
          <span className="seat__count">{cardsLeft}</span>
        </div>
      )}
    </div>
  );
}

function YourHand({
  state,
  isHumanTurn,
  legalIds,
  onPlay,
}: {
  state: GameState;
  isHumanTurn: boolean;
  legalIds: Set<string>;
  onPlay: (card: GameState['hands'][number][number]) => void;
}) {
  const hand = sortHand(state.hands[HUMAN]);
  return (
    <div className="hand">
      {hand.map((card) => {
        const id = cardId(card);
        const playable = isHumanTurn && legalIds.has(id);
        const dimmed = isHumanTurn && !legalIds.has(id);
        return (
          <CardView
            key={id}
            card={card}
            size="lg"
            highlight={playable}
            dimmed={dimmed}
            onClick={playable ? () => onPlay(card) : undefined}
          />
        );
      })}
    </div>
  );
}

function HandOverlay({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const r = state.lastHandResult!;
  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="panel__title">Fim da mão {state.handNumber}</h2>
        {r.moonShooter !== null && (
          <p className="panel__moon">
            🌙 {state.players[r.moonShooter]} acertou na lua! Leva 0; os outros levam 20.
          </p>
        )}
        <table className="scoretable">
          <thead>
            <tr>
              <th>Jogador</th>
              <th>Esta mão</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {state.players.map((name, i) => (
              <tr key={i}>
                <td>{i === HUMAN ? 'Tu' : name}</td>
                <td>+{r.appliedPoints[i]}</td>
                <td>{state.scores[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn" onClick={onContinue}>
          Continuar
        </button>
      </div>
    </div>
  );
}

function MatchOverlay({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const losers = state.losers ?? [];
  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="panel__title">Fim de jogo</h2>
        <p className="panel__losers">
          {losers.length === 1 ? 'Perdeu: ' : 'Perderam: '}
          {losers.map((i) => (i === HUMAN ? 'Tu' : state.players[i])).join(', ')}
        </p>
        <table className="scoretable">
          <thead>
            <tr>
              <th>Jogador</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {state.players
              .map((name, i) => ({ name: i === HUMAN ? 'Tu' : name, score: state.scores[i], i }))
              .sort((a, b) => a.score - b.score)
              .map(({ name, score, i }) => (
                <tr key={i} className={losers.includes(i) ? 'row--loser' : ''}>
                  <td>{name}</td>
                  <td>{score}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <button className="btn" onClick={onRestart}>
          Jogar outra vez
        </button>
      </div>
    </div>
  );
}
