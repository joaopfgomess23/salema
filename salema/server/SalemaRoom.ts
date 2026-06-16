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
  isQueenOfSpades,
} from '../src/engine';
import { chooseBotMove } from '../src/bots/simpleBot';
import {
  GameView,
  LobbyView,
  PlayerView,
  CompletedTrickView,
  TrickPlayView,
  GameMode,
} from '../src/shared/protocol';
import { verifyToken } from './auth';
import { Storage, MatchPlayerResult } from './storage';

const NUM_SEATS = 5;
const BOT_DELAY_MS = Number(process.env.SALEMA_BOT_DELAY ?? 750);
const TRICK_PAUSE_MS = Number(process.env.SALEMA_TRICK_PAUSE ?? 1400);
const HAND_REVIEW_MS = Number(process.env.SALEMA_HAND_REVIEW ?? 4500);
const RECONNECT_SECONDS = Number(process.env.SALEMA_RECONNECT ?? 60);
const BOT_POOL = ['Bummy', 'Pisca', 'Bumaro', 'FF'];

// O colyseus 0.15 é CommonJS; carregamo-lo com require (mantendo os tipos).
const require = createRequire(import.meta.url);
const { Room } = require('colyseus') as typeof import('colyseus');

// Persistência partilhada (injetada no arranque). Só usada no modo ranked.
let storage: Storage | null = null;
export function setStorage(s: Storage) {
  storage = s;
}

interface LobbyHuman {
  sessionId: string;
  name: string;
  userId: number | null; // só em ranked
}

interface AuthData {
  userId: number;
  username: string;
}

export class SalemaRoom extends Room {
  maxClients = NUM_SEATS;

  private mode: GameMode = 'casual';
  private lobby: LobbyHuman[] = [];
  private started = false;
  private match: GameState | null = null;
  private seatSession: (string | null)[] = new Array(NUM_SEATS).fill(null);
  private seatUserId: (number | null)[] = new Array(NUM_SEATS).fill(null);
  private seatIsBot: boolean[] = new Array(NUM_SEATS).fill(false);
  private seatConnected: boolean[] = new Array(NUM_SEATS).fill(false);
  private salemas: number[] = new Array(NUM_SEATS).fill(0);
  private moons: number[] = new Array(NUM_SEATS).fill(0);
  private paused = false;
  private tainted = false; // ranked invalidado (ex.: alguém não voltou) -> não conta
  private recorded = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private get requireAuth() {
    return this.mode === 'ranked';
  }
  private get fillWithBots() {
    return this.mode === 'casual';
  }
  private get minHumans() {
    return this.mode === 'ranked' ? NUM_SEATS : 1;
  }
  private get recordStats() {
    return this.mode === 'ranked';
  }

  onCreate(options: { mode?: GameMode }) {
    this.mode = options?.mode === 'ranked' ? 'ranked' : 'casual';
    this.onMessage('start', (client) => this.startGame(client));
    this.onMessage('play', (client, msg: { cardId: string }) =>
      this.handlePlay(client, msg?.cardId),
    );
  }

  // No ranked, exige sessão iniciada (token válido). No casual, entra à vontade.
  onAuth(_client: Client, options: { token?: string }): AuthData | boolean {
    if (!this.requireAuth) return true;
    const payload = options?.token ? verifyToken(options.token) : null;
    if (!payload) {
      throw new Error('Tens de iniciar sessão para jogar no modo Ranked.');
    }
    return { userId: payload.userId, username: payload.username };
  }

  // -------------------------------------------------------------- entradas --

  onJoin(client: Client, options: { name?: string }) {
    if (this.started) {
      throw new Error('O jogo já começou nesta sala.');
    }
    let name: string;
    let userId: number | null = null;
    if (this.requireAuth) {
      const auth = client.auth as AuthData;
      userId = auth.userId;
      name = auth.username;
      if (this.lobby.some((h) => h.userId === userId)) {
        throw new Error('Já estás nesta sala noutra janela.');
      }
    } else {
      name = (options?.name || '').trim().slice(0, 16) || `Jogador ${this.lobby.length + 1}`;
    }

    this.lobby.push({ sessionId: client.sessionId, name, userId });
    if (this.lobby.length >= NUM_SEATS) this.lock();
    this.broadcastLobby();

    // No ranked começa automaticamente quando estiverem os 5.
    if (this.requireAuth && this.lobby.length === NUM_SEATS) {
      this.beginMatch();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    if (!this.started) {
      this.lobby = this.lobby.filter((h) => h.sessionId !== client.sessionId);
      this.broadcastLobby();
      return;
    }
    const seat = this.seatSession.indexOf(client.sessionId);
    if (seat < 0) return;

    // No ranked, dá-se uma hipótese de reentrar antes de desistir do lugar.
    if (this.mode === 'ranked' && !consented) {
      this.seatConnected[seat] = false;
      this.broadcastState();
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        this.seatConnected[seat] = true; // voltou
        this.broadcastState();
        return;
      } catch {
        // não voltou a tempo: a partida deixa de contar e um bot acaba o jogo
        this.tainted = true;
      }
    }

    this.seatConnected[seat] = false;
    this.seatIsBot[seat] = true;
    this.seatSession[seat] = null;
    this.broadcastState();
    if (this.match?.phase === 'playing' && this.match.currentPlayer === seat) {
      this.scheduleNext(false);
    }
  }

  onDispose() {
    this.clearTimer();
  }

  // ---------------------------------------------------------------- lobby ---

  private canStart() {
    return this.lobby.length >= this.minHumans;
  }

  private broadcastLobby() {
    this.clients.forEach((client) => {
      const yourSeat = this.lobby.findIndex((h) => h.sessionId === client.sessionId);
      const view: LobbyView = {
        type: 'lobby',
        mode: this.mode,
        players: this.lobby.map((h) => ({ name: h.name, isBot: false })),
        yourSeat,
        canStart: this.canStart(),
        minPlayers: this.minHumans,
        started: false,
      };
      client.send('view', view);
    });
  }

  private startGame(client: Client) {
    // No ranked é automático; ignoramos pedidos manuais.
    if (this.mode === 'ranked') return;
    if (!this.lobby.some((h) => h.sessionId === client.sessionId)) return;
    if (!this.canStart()) return;
    this.beginMatch();
  }

  private beginMatch() {
    if (this.started || !this.canStart()) return;

    const humanNames = this.lobby.map((h) => h.name);
    const players: string[] = [...humanNames];

    if (this.fillWithBots) {
      const used = new Set(humanNames);
      let poolIndex = 0;
      for (let seat = humanNames.length; seat < NUM_SEATS; seat++) {
        let botName = BOT_POOL[poolIndex++] ?? `Bot ${seat}`;
        while (used.has(botName)) botName = `${botName}*`;
        used.add(botName);
        players.push(botName);
      }
    }

    for (let seat = 0; seat < NUM_SEATS; seat++) {
      const human = this.lobby[seat];
      this.seatSession[seat] = human ? human.sessionId : null;
      this.seatUserId[seat] = human ? human.userId : null;
      this.seatIsBot[seat] = !human;
      this.seatConnected[seat] = !!human;
    }

    this.match = createMatch(players);
    this.started = true;
    this.lock();
    this.broadcastState();
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
    const justCompleted = this.match.completedTricks.length > before;

    // Quando uma mão acaba de ser pontuada, acumulamos Salemas e luas.
    if (this.match.phase === 'handComplete' || this.match.phase === 'matchComplete') {
      this.accumulateHandStats();
    }
    if (this.match.phase === 'matchComplete') {
      void this.recordResults();
    }

    this.broadcastState();
    this.scheduleNext(justCompleted);
  }

  private accumulateHandStats() {
    if (!this.match) return;
    for (const trick of this.match.completedTricks) {
      if (trick.plays.some((p) => isQueenOfSpades(p.card))) {
        this.salemas[trick.winner] += 1;
      }
    }
    const ms = this.match.lastHandResult?.moonShooter;
    if (ms !== null && ms !== undefined) this.moons[ms] += 1;
  }

  private async recordResults() {
    if (this.recorded || !this.recordStats || this.tainted || !this.match || !storage) return;
    this.recorded = true;
    const m = this.match;
    const losers = m.losers ?? [];
    const results: MatchPlayerResult[] = [];
    for (let seat = 0; seat < NUM_SEATS; seat++) {
      const uid = this.seatUserId[seat];
      if (uid == null) continue;
      results.push({
        userId: uid,
        finalScore: m.scores[seat],
        lost: losers.includes(seat),
        salemas: this.salemas[seat],
        moons: this.moons[seat],
      });
    }
    try {
      await storage.recordMatch(results);
    } catch (e) {
      console.error('Falha a registar estatísticas ranked:', e);
    }
  }

  // -------------------------------------------------- máquina de progresso --

  private scheduleNext(justCompleted: boolean) {
    this.clearTimer();
    if (justCompleted) {
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

    if (m.phase === 'matchComplete') return;

    if (m.phase === 'handComplete') {
      this.timer = setTimeout(() => {
        if (!this.match) return;
        this.match = continueToNextHand(this.match);
        this.broadcastState();
        this.scheduleNext(false);
      }, HAND_REVIEW_MS);
      return;
    }

    const cur = m.currentPlayer;
    if (this.seatIsBot[cur] || !this.seatConnected[cur]) {
      this.timer = setTimeout(() => {
        if (this.match && this.match.phase === 'playing') {
          this.applyMove(chooseBotMove(this.match));
        }
      }, BOT_DELAY_MS);
    }
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
    this.clients.forEach((client) => {
      const seat = this.seatOf(client.sessionId);
      if (seat < 0) return;
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
      mode: this.mode,
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
