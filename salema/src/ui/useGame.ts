import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GameState,
  Card,
  createMatch,
  playCard,
  continueToNextHand,
  legalMoveIds,
  cardId,
} from '../engine';
import { chooseBotMove } from '../bots/simpleBot';

export const HUMAN = 0;
const BOT_DELAY_MS = 750; // pausa para o humano ver a jogada do bot

export interface UseGame {
  state: GameState;
  waiting: boolean; // pausa no fim de uma vazada (mostra o "Próxima vazada")
  peeking: boolean; // a rever vazadas anteriores (a qualquer momento)
  peekIndex: number; // vazada que está a ser revista
  canPeek: boolean; // há pelo menos uma vazada terminada para rever
  canPeekPrev: boolean;
  canPeekNext: boolean;
  isHumanTurn: boolean;
  legalIds: Set<string>;
  showHandOverlay: boolean;
  showMatchOverlay: boolean;
  playHuman: (card: Card) => void;
  advanceTrick: () => void; // "Próxima vazada" — só no fim da vazada
  openPeek: () => void; // "Ver vazada anterior" — sempre disponível
  closePeek: () => void;
  peekPrev: () => void;
  peekNext: () => void;
  nextHand: () => void;
  restart: () => void;
}

export function useGame(playerNames: string[]): UseGame {
  const [state, setState] = useState<GameState>(() => createMatch(playerNames));
  const [waiting, setWaiting] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [peekIndex, setPeekIndex] = useState(0);
  const prevCompleted = useRef(0);

  const lastCompleted = state.completedTricks.length - 1;

  const restart = useCallback(() => {
    prevCompleted.current = 0;
    setWaiting(false);
    setPeeking(false);
    setPeekIndex(0);
    setState(createMatch(playerNames));
  }, [playerNames]);

  const playHuman = useCallback((card: Card) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.currentPlayer !== HUMAN) return prev;
      if (!legalMoveIds(prev).has(cardId(card))) return prev;
      return playCard(prev, card);
    });
  }, []);

  const advanceTrick = useCallback(() => {
    setWaiting(false);
  }, []);

  const openPeek = useCallback(() => {
    setState((prev) => {
      const last = prev.completedTricks.length - 1;
      if (last < 0) return prev;
      setPeekIndex(last);
      setPeeking(true);
      return prev;
    });
  }, []);

  const closePeek = useCallback(() => setPeeking(false), []);
  const peekPrev = useCallback(() => setPeekIndex((i) => Math.max(0, i - 1)), []);
  const peekNext = useCallback(
    () => setPeekIndex((i) => Math.min(lastCompleted, i + 1)),
    [lastCompleted],
  );

  const nextHand = useCallback(() => {
    prevCompleted.current = 0;
    setWaiting(false);
    setPeeking(false);
    setPeekIndex(0);
    setState((prev) => (prev.phase === 'handComplete' ? continueToNextHand(prev) : prev));
  }, []);

  // Sempre que uma vazada termina, pausa para mostrar o "Próxima vazada".
  useEffect(() => {
    const len = state.completedTricks.length;
    if (len > prevCompleted.current) {
      setWaiting(true);
    }
    prevCompleted.current = len;
  }, [state.completedTricks.length, state.handNumber]);

  // Jogada automática dos bots (parada enquanto está em pausa ou em revisão).
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.currentPlayer === HUMAN) return;
    if (waiting || peeking) return;
    const t = setTimeout(() => {
      setState((prev) => {
        if (prev.phase !== 'playing' || prev.currentPlayer === HUMAN) return prev;
        return playCard(prev, chooseBotMove(prev));
      });
    }, BOT_DELAY_MS);
    return () => clearTimeout(t);
  }, [state, waiting, peeking]);

  const isHumanTurn =
    state.phase === 'playing' && state.currentPlayer === HUMAN && !waiting && !peeking;
  const legalIds = isHumanTurn ? legalMoveIds(state) : new Set<string>();

  const showHandOverlay = state.phase === 'handComplete' && !waiting && !peeking;
  const showMatchOverlay = state.phase === 'matchComplete' && !waiting && !peeking;

  return {
    state,
    waiting,
    peeking,
    peekIndex,
    canPeek: state.completedTricks.length > 0 && !showHandOverlay && !showMatchOverlay,
    canPeekPrev: peeking && peekIndex > 0,
    canPeekNext: peeking && peekIndex < lastCompleted,
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
  };
}
