// ---------------------------------------------------------------------------
// Contrato de mensagens entre o servidor (Colyseus) e o cliente online.
//
// Partilhado pelos dois lados para não haver divergências. Só usa tipos simples
// (strings) para não acoplar o cliente/servidor a detalhes internos do motor.
// ---------------------------------------------------------------------------

export interface CardData {
  suit: string; // 'clubs' | 'diamonds' | 'spades' | 'hearts'
  rank: string; // '2'..'7' | 'Q' | 'J' | 'K' | 'A'
}

export interface TrickPlayView {
  player: number;
  card: CardData;
}

export interface CompletedTrickView {
  plays: TrickPlayView[];
  winner: number;
}

export interface HandResultView {
  appliedPoints: number[];
  rawPoints: number[];
  moonShooter: number | null;
}

export interface PlayerView {
  name: string;
  isBot: boolean;
  connected: boolean;
  score: number;
  cardsLeft: number;
  handPoints: number;
}

/** Enviado enquanto a sala está no lobby (antes do jogo começar). */
export interface LobbyView {
  type: 'lobby';
  players: { name: string; isBot: boolean }[];
  yourSeat: number;
  canStart: boolean;
  started: boolean;
}

/** Vista do jogo, já filtrada para um jogador específico. */
export interface GameView {
  type: 'state';
  yourSeat: number;
  phase: 'playing' | 'handComplete' | 'matchComplete';
  players: PlayerView[];
  currentPlayer: number;
  yourTurn: boolean;
  hand: CardData[]; // só a TUA mão
  legalCardIds: string[]; // jogadas legais (só quando é a tua vez)
  currentTrick: TrickPlayView[];
  completedTricks: CompletedTrickView[];
  heartsBroken: boolean;
  handNumber: number;
  trickNumber: number;
  paused: boolean; // servidor em pausa curta a mostrar a vazada ganha
  lastHandResult: HandResultView | null;
  losers: number[] | null;
}

export interface ErrorView {
  type: 'error';
  message: string;
}

export type ServerMessage = LobbyView | GameView | ErrorView;

// Mensagens do cliente para o servidor
export interface PlayMessage {
  cardId: string;
}
