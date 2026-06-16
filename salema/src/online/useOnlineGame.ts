import { useCallback, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import { GameView, LobbyView, ServerMessage, GameMode } from '../shared/protocol';

const DEFAULT_URL = import.meta.env?.VITE_SERVER_URL || 'ws://localhost:2567';

export type OnlineStatus = 'idle' | 'connecting' | 'lobby' | 'playing' | 'ended' | 'error';

export interface ConnectOptions {
  mode: GameMode;
  name?: string; // casual
  token?: string; // ranked
}

export interface UseOnlineGame {
  status: OnlineStatus;
  lobby: LobbyView | null;
  view: GameView | null;
  error: string | null;
  connect: (opts: ConnectOptions) => Promise<void>;
  start: () => void;
  play: (cardId: string) => void;
  leave: () => void;
}

export function useOnlineGame(): UseOnlineGame {
  const [status, setStatus] = useState<OnlineStatus>('idle');
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  const reset = useCallback(() => {
    roomRef.current = null;
    setLobby(null);
    setView(null);
  }, []);

  const connect = useCallback(
    async ({ mode, name, token }: ConnectOptions) => {
      setError(null);
      setStatus('connecting');
      try {
        const client = new Client(DEFAULT_URL);
        const roomName = mode === 'ranked' ? 'salema_ranked' : 'salema';
        const options = mode === 'ranked' ? { token } : { name };
        const room = await client.joinOrCreate(roomName, options);
        roomRef.current = room;

        room.onMessage('view', (msg: ServerMessage) => {
          if (msg.type === 'lobby') {
            setLobby(msg);
            setStatus((s) => (s === 'playing' || s === 'ended' ? s : 'lobby'));
          } else if (msg.type === 'state') {
            setView(msg);
            setStatus(msg.phase === 'matchComplete' ? 'ended' : 'playing');
          } else if (msg.type === 'error') {
            setError(msg.message);
          }
        });

        room.onError((code, message) => {
          setError(message || `Erro de ligação (${code})`);
          setStatus('error');
        });

        room.onLeave(() => {
          // Saída do servidor (ex.: sala fechada). Volta ao início se ainda não acabou.
          setStatus((s) => (s === 'ended' ? s : 'idle'));
          reset();
        });

        setStatus('lobby');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível ligar ao servidor.');
        setStatus('error');
      }
    },
    [reset],
  );

  const start = useCallback(() => {
    roomRef.current?.send('start');
  }, []);

  const play = useCallback((cardId: string) => {
    roomRef.current?.send('play', { cardId });
  }, []);

  const leave = useCallback(() => {
    try {
      roomRef.current?.leave();
    } catch {
      /* ignore */
    }
    reset();
    setError(null);
    setStatus('idle');
  }, [reset]);

  return { status, lobby, view, error, connect, start, play, leave };
}
