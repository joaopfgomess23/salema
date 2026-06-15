import { createRequire } from 'module';
import type { Client } from 'colyseus';
import {
  GameState,
  Card,
  createMatch,
  playCard,
  continueToNextHand,
  getLegalMoves,
  cardId,
  sortHand,
  handPointsSoFar,
} from '../src/engine';
import { chooseBotMove } from '../src/bots/simpleBot';
import {
  GameView,
  LobbyView,
  PlayerView,
  CompletedTrickView,
  TrickPlayView,
} from '../src/shared/protocol';

const NUM_SEATS = 5;
const BOT_DELAY_MS = Number(process.env.SALEMA_BOT_DELAY ?? 750); // "pensar" de um bot
const TRICK_PAUSE_MS = Number(process.env.SALEMA_TRICK_PAUSE ?? 1400); // mostra a vazada ganha
const HAND_REVIEW_MS = Number(process.env.SALEMA_HAND_REVIEW ?? 4500); // mostra resultado da mão
const BOT_POOL = ['Bummy', 'Pisca', 'Bumaro', 'FF'];

// O colyseus 0.15 é CommonJS; carregamo-lo com require (mantendo os tipos).
const require = createRequire(import.meta.url);
const { Room } = require('colyseus') as typeof import('colyseus');

const DEBUG = !!process.env.SALEMA_DEBUG;
const log = (...a: unknown[]) => {
  if (DEBUG) console.error('[room]', ...a);
};

interface LobbyHuman {
  sessionId: string;
  name: string;
}

export class SalemaRoom extends Room {
  maxClients = NUM_SEATS;

  private lobby: LobbyHuman[] = [];
  private started = false;
  private match: GameState | null = null;
  private seatSession: (string | null)[] = new Array(NUM_SEATS).fill(null);
  private seatIsBot: boolean[] = new Array(NUM_SEATS).fill(false);
  private seatConnected: boolean[] = new Array(NUM_SEATS).fill(false);
  private paused = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  onCreate() {
    this.onMessage('start', (client) => this.startGame(client));
    this.onMessage('play', (client, msg: { cardId: string }) =>
      this.handlePlay(client, msg?.cardId),
    );
  }

  // -------------------------------------------------------------- entradas --

  onJoin(client: Client, options: { name?: string }) {
    if (this.started) {
      throw new Error('O jogo já começou nesta sala.');
    }
    const name = (options?.name || '').trim().slice(0, 16) || `Jogador ${this.lobby.length + 1}`;
    this.lobby.push({ sessionId: client.sessionId, name });
    log('onJoin', name, 'lobby=', this.lobby.length);
    if (this.lobby.length >= NUM_SEATS) this.lock();
    this.broadcastLobby();
  }

  onLeave(client: Client) {
    if (!this.started) {
      this.lobby = this.lobby.filter((h) => h.sessionId !== client.sessionId);
      this.broadcastLobby();
      return;
    }
    // Durante o jogo: o lugar passa a ser controlado por um bot.
    const seat = this.seatSession.indexOf(client.sessionId);
    if (seat >= 0) {
      this.seatConnected[seat] = false;
      this.seatIsBot[seat] = true;
      this.seatSession[seat] = null;
      this.broadcastState();
      if (this.match?.phase === 'playing' && this.match.currentPlayer === seat) {
        this.scheduleNext(false); // o bot assume a vez
      }
    }
  }

  onDispose() {
    this.clearTimer();
  }

  // ---------------------------------------------------------------- lobby ---

  private broadcastLobby() {
    this.clients.forEach((client) => {
      const yourSeat = this.lobby.findIndex((h) => h.sessionId === client.sessionId);
      const view: LobbyView = {
        type: 'lobby',
        players: this.lobby.map((h) => ({ name: h.name, isBot: false })),
        yourSeat,
        canStart: this.lobby.length >= 1,
        started: false,
      };
      client.send('view', view);
    });
  }

  private startGame(client: Client) {
    if (this.started) return;
    if (!this.lobby.some((h) => h.sessionId === client.sessionId)) return;
    if (this.lobby.length < 1) return;

    const humanNames = this.lobby.map((h) => h.name);
    const used = new Set(humanNames);
    const players: string[] = [...humanNames];
    let poolIndex = 0;
    for (let seat = humanNames.length; seat < NUM_SEATS; seat++) {
      let botName = BOT_POOL[poolIndex++] ?? `Bot ${seat}`;
      while (used.has(botName)) botName = `${botName}*`;
      used.add(botName);
      players.push(botName);
    }

    for (let seat = 0; seat < NUM_SEATS; seat++) {
      const human = this.lobby[seat];
      this.seatSession[seat] = human ? human.sessionId : null;
      this.seatIsBot[seat] = !human;
      this.seatConnected[seat] = !!human;
    }

    log('startGame players=', players);
    this.match = createMatch(players);
    this.started = true;
    this.lock();
    this.broadcastState();
    log('started, currentPlayer=', this.match.currentPlayer, 'isBot=', this.seatIsBot[this.match.currentPlayer]);
    this.scheduleNext(false);
  }

  // ---------------------------------------------------------------- jogadas --

  private seatOf(sessionId: string): number {
    return this.seatSession.indexOf(sessionId);
  }

  private handlePlay(client: Client, id: string | undefined) {
    if (!this.started || !this.match || this.match.phase !== 'playing' || this.paused) return;
    const seat = this.seatOf(client.sessionId);
    if (seat < 0 || seat !== this.match.currentPlayer) return;
    const legal = getLegalMoves(this.match);
    const card = legal.find((c) => cardId(c) === id);
    if (!card) {
      client.send('view', { type: 'error', message: 'Jogada ilegal.' });
      return;
    }
    this.applyMove(card);
  }

  private applyMove(card: Card) {
    if (!this.match) return;
    const before = this.match.completedTricks.length;
    this.match = playCard(this.match, card);
    log('applyMove -> phase=', this.match.phase, 'cur=', this.match.currentPlayer, 'completed=', this.match.completedTricks.length);
    const justCompleted = this.match.completedTricks.length > before;
    this.broadcastState();
    this.scheduleNext(justCompleted);
  }

  // -------------------------------------------------- máquina de progresso --

  private scheduleNext(justCompleted: boolean) {
    this.clearTimer();
    if (justCompleted) {
      // Pausa curta a mostrar a vazada ganha, depois prossegue.
      this.paused = true;
      this.broadcastState();
      this.timer = setTimeout(() => {
        this.paused = false;
        this.broadcastState();
        this.proceed();
      }, TRICK_PAUSE_MS);
      return;
    }
    this.proceed();
  }

  private proceed() {
    if (!this.match) return;
    const m = this.match;
    log('proceed phase=', m.phase, 'cur=', m.currentPlayer, 'isBot=', this.seatIsBot[m.currentPlayer], 'connected=', this.seatConnected[m.currentPlayer]);

    if (m.phase === 'matchComplete') return; // fim — o cliente mostra o resultado

    if (m.phase === 'handComplete') {
      // Mostra o resumo da mão durante uns segundos e distribui a seguinte.
      this.timer = setTimeout(() => {
        if (!this.match) return;
        this.match = continueToNextHand(this.match);
        this.broadcastState();
        this.scheduleNext(false);
      }, HAND_REVIEW_MS);
      return;
    }

    // A jogar: se for a vez de um bot (ou de um lugar desligado), joga ele.
    const cur = m.currentPlayer;
    if (this.seatIsBot[cur] || !this.seatConnected[cur]) {
      this.timer = setTimeout(() => {
        if (this.match && this.match.phase === 'playing') {
          this.applyMove(chooseBotMove(this.match));
        }
      }, BOT_DELAY_MS);
    }
    // Caso contrário, espera-se a mensagem 'play' do humano.
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // ----------------------------------------------------------- vistas (UI) --

  private broadcastState() {
    if (!this.match) return;
    log('broadcastState clients=', this.clients.length);
    this.clients.forEach((client) => {
      const seat = this.seatOf(client.sessionId);
      if (seat < 0) return; // não está sentado (não devia acontecer)
      client.send('view', this.buildView(seat));
    });
  }

  private buildView(seat: number): GameView {
    const m = this.match!;
    const players: PlayerView[] = m.players.map((name, i) => ({
      name,
      isBot: this.seatIsBot[i],
      connected: this.seatConnected[i],
      score: m.scores[i],
      cardsLeft: m.hands[i].length,
      handPoints: handPointsSoFar(m, i),
    }));

    const toPlay = (p: { player: number; card: Card }): TrickPlayView => ({
      player: p.player,
      card: { suit: p.card.suit, rank: p.card.rank },
    });
    const completedTricks: CompletedTrickView[] = m.completedTricks.map((t) => ({
      plays: t.plays.map(toPlay),
      winner: t.winner,
    }));

    const yourTurn = m.phase === 'playing' && m.currentPlayer === seat && !this.paused;

    return {
      type: 'state',
      yourSeat: seat,
      phase: m.phase,
      players,
      currentPlayer: m.currentPlayer,
      yourTurn,
      hand: sortHand(m.hands[seat]).map((c) => ({ suit: c.suit, rank: c.rank })),
      legalCardIds: yourTurn ? getLegalMoves(m).map(cardId) : [],
      currentTrick: m.currentTrick.map(toPlay),
      completedTricks,
      heartsBroken: m.heartsBroken,
      handNumber: m.handNumber,
      trickNumber: m.trickNumber,
      paused: this.paused,
      lastHandResult: m.lastHandResult
        ? {
            appliedPoints: m.lastHandResult.appliedPoints,
            rawPoints: m.lastHandResult.rawPoints,
            moonShooter: m.lastHandResult.moonShooter,
          }
        : null,
      losers: m.losers,
    };
  }
}
