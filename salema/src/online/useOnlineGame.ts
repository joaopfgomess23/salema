import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import {
  GameView,
  LobbyView,
  ServerMessage,
  GameMode,
  ChatPayload,
  RoomMeta,
} from '../shared/protocol';

const DEFAULT_URL = import.meta.env?.VITE_SERVER_URL || 'ws://localhost:2567';

export type OnlineStatus =
  | 'idle'
  | 'connecting'
  | 'lobby'
  | 'playing'
  | 'ended'
  | 'error'
  | 'reconnecting';

export interface ConnectOptions {
  mode: GameMode;
  name?: string; // casual
  token?: string; // ranked
}

export interface RoomInfo {
  roomId: string;
  clients: number;
  maxClients: number;
  hostName: string;
  mode: GameMode;
}

export interface UseOnlineGame {
  status: OnlineStatus;
  lobby: LobbyView | null;
  view: GameView | null;
  error: string | null;
  chat: ChatPayload[];
  listRooms: (mode: GameMode) => Promise<RoomInfo[]>;
  createRoom: (opts: ConnectOptions) => Promise<void>;
  joinRoom: (roomId: string, opts: ConnectOptions) => Promise<void>;
  start: () => void;
  play: (cardId: string) => void;
  sendChat: (text: string) => void;
  leave: () => void;
}

const roomName = (mode: GameMode) => (mode === 'ranked' ? 'salema_ranked' : 'salema');
const joinOptions = (o: ConnectOptions) => (o.mode === 'ranked' ? { token: o.token } : { name: o.name });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Guardamos o token de reconexão para aguentar uma queda de ligação (mesmo um refresh).
const RECONNECT_KEY = 'salema_reconnect';
const saveToken = (t: string | null) => {
  try {
    if (t) sessionStorage.setItem(RECONNECT_KEY, t);
    else sessionStorage.removeItem(RECONNECT_KEY);
  } catch {
    /* ignore */
  }
};
const readSavedToken = () => {
  try {
    return sessionStorage.getItem(RECONNECT_KEY);
  } catch {
    return null;
  }
};

/** Há uma partida para retomar (token guardado de uma queda/refresh recente)? */
export function hasPendingReconnect(): boolean {
  return !!readSavedToken();
}

export function useOnlineGame(): UseOnlineGame {
  const [status, setStatus] = useState<OnlineStatus>('idle');
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatPayload[]>([]);

  const clientRef = useRef<Client | null>(null);
  const roomRef = useRef<Room | null>(null);
  const reconnectTokenRef = useRef<string | null>(null);
  const leftByUserRef = useRef(false);
  const statusRef = useRef<OnlineStatus>('idle');

  const setStat = useCallback((s: OnlineStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const ensureClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = new Client(DEFAULT_URL);
    return clientRef.current;
  }, []);

  const reset = useCallback(() => {
    roomRef.current = null;
    reconnectTokenRef.current = null;
    setLobby(null);
    setView(null);
  }, []);

  const attemptReconnect = useCallback(
    async (maxTries = 8, silent = false) => {
      const token = reconnectTokenRef.current || readSavedToken();
      const client = ensureClient();
      if (!token) {
        setStat('idle');
        reset();
        return;
      }
      reconnectTokenRef.current = token;
      setStat('reconnecting');
      for (let i = 0; i < maxTries; i++) {
        try {
          const room = await client.reconnect(token);
          bindRoom(room);
          return; // o estado segue pelas mensagens 'view'
        } catch {
          if (i < maxTries - 1) await sleep(3000);
        }
      }
      saveToken(null);
      reconnectTokenRef.current = null;
      if (silent) {
        setStat('idle');
      } else {
        setError('Ligação perdida. Não foi possível voltar à partida.');
        setStat('error');
      }
      reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [setStat, reset, ensureClient],
  );

  const bindRoom = useCallback(
    (room: Room) => {
      roomRef.current = room;
      reconnectTokenRef.current = room.reconnectionToken;
      saveToken(room.reconnectionToken);
      leftByUserRef.current = false;

      room.onMessage('view', (msg: ServerMessage) => {
        if (msg.type === 'lobby') {
          setLobby(msg);
          setStat(statusRef.current === 'playing' || statusRef.current === 'ended' ? statusRef.current : 'lobby');
        } else if (msg.type === 'state') {
          setView(msg);
          reconnectTokenRef.current = room.reconnectionToken;
          if (msg.phase === 'matchComplete') {
            saveToken(null); // jogo terminou: já não há para onde voltar
            setStat('ended');
          } else {
            saveToken(room.reconnectionToken);
            setStat('playing');
          }
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      });

      room.onMessage('chat', (msg: ChatPayload) => {
        setChat((prev) => [...prev.slice(-60), msg]);
      });

      room.onError((code, message) => {
        setError(message || `Erro de ligação (${code})`);
        setStat('error');
      });

      room.onLeave(() => {
        if (leftByUserRef.current) {
          setStat('idle');
          reset();
          return;
        }
        if (statusRef.current === 'ended') return; // jogo terminou normalmente
        if (statusRef.current === 'playing') {
          attemptReconnect(); // queda a meio do jogo -> tenta voltar
        } else {
          setStat('idle');
          reset();
        }
      });
    },
    [setStat, reset, attemptReconnect],
  );

  const listRooms = useCallback(
    async (mode: GameMode): Promise<RoomInfo[]> => {
      const client = ensureClient();
      const rooms = await client.getAvailableRooms<RoomMeta>(roomName(mode));
      return rooms
        .filter((r) => !r.metadata?.started)
        .map((r) => ({
          roomId: r.roomId,
          clients: r.clients,
          maxClients: r.maxClients,
          hostName: r.metadata?.hostName || 'sala',
          mode,
        }));
    },
    [ensureClient],
  );

  const createRoom = useCallback(
    async (opts: ConnectOptions) => {
      setError(null);
      setChat([]);
      setStat('connecting');
      try {
        const client = ensureClient();
        const room = await client.create(roomName(opts.mode), joinOptions(opts));
        bindRoom(room);
        setStat('lobby');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível criar a sala.');
        setStat('error');
      }
    },
    [ensureClient, bindRoom, setStat],
  );

  const joinRoom = useCallback(
    async (roomId: string, opts: ConnectOptions) => {
      setError(null);
      setChat([]);
      setStat('connecting');
      try {
        const client = ensureClient();
        const room = await client.joinById(roomId, joinOptions(opts));
        bindRoom(room);
        setStat('lobby');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível entrar na sala.');
        setStat('error');
      }
    },
    [ensureClient, bindRoom, setStat],
  );

  const start = useCallback(() => roomRef.current?.send('start'), []);
  const play = useCallback((cardId: string) => roomRef.current?.send('play', { cardId }), []);
  const sendChat = useCallback((text: string) => {
    const t = text.trim();
    if (t) roomRef.current?.send('chat', { text: t });
  }, []);

  const leave = useCallback(() => {
    leftByUserRef.current = true;
    saveToken(null);
    try {
      roomRef.current?.leave();
    } catch {
      /* ignore */
    }
    reset();
    setChat([]);
    setError(null);
    setStat('idle');
  }, [reset, setStat]);

  // Se houver um token guardado (queda recente / refresh), tenta voltar à partida.
  useEffect(() => {
    if (readSavedToken()) attemptReconnect(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, lobby, view, error, chat, listRooms, createRoom, joinRoom, start, play, sendChat, leave };
}
