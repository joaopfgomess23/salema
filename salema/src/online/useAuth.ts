import { useCallback, useEffect, useState } from 'react';

const WS_URL = import.meta.env?.VITE_SERVER_URL || 'ws://localhost:2567';
export const HTTP_BASE = WS_URL.replace(/^ws/, 'http'); // ws->http, wss->https
const TOKEN_KEY = 'salema_token';

export interface Account {
  id: number;
  username: string;
}
export interface MyStats {
  username: string;
  gamesPlayed: number;
  defeats: number;
  totalPoints: number;
  salemas: number;
  moons: number;
}

export type AuthStatus = 'loading' | 'anon' | 'authed';

export interface UseAuth {
  status: AuthStatus;
  user: Account | null;
  token: string | null;
  stats: MyStats | null;
  error: string | null;
  busy: boolean;
  register: (username: string, password: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refresh: () => Promise<void>;
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function useAuth(): UseAuth {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(() => readToken());
  const [stats, setStats] = useState<MyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMe = useCallback(async (tk: string) => {
    try {
      const r = await fetch(`${HTTP_BASE}/me`, { headers: { Authorization: `Bearer ${tk}` } });
      if (!r.ok) throw new Error('sessão inválida');
      const j = await r.json();
      setUser(j.user);
      setStats(j.stats);
      setStatus('authed');
    } catch {
      writeToken(null);
      setToken(null);
      setUser(null);
      setStats(null);
      setStatus('anon');
    }
  }, []);

  // Ao carregar, valida o token guardado.
  useEffect(() => {
    const tk = readToken();
    if (tk) loadMe(tk);
    else setStatus('anon');
  }, [loadMe]);

  const authRequest = useCallback(
    async (path: string, username: string, password: string) => {
      setError(null);
      setBusy(true);
      try {
        const r = await fetch(`${HTTP_BASE}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const j = await r.json();
        if (!r.ok) {
          setError(j.error || 'Ocorreu um erro.');
          return false;
        }
        writeToken(j.token);
        setToken(j.token);
        setUser(j.user);
        setStatus('authed');
        await loadMe(j.token); // traz estatísticas
        return true;
      } catch {
        setError('Não foi possível contactar o servidor.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [loadMe],
  );

  const register = useCallback(
    (u: string, p: string) => authRequest('/auth/register', u, p),
    [authRequest],
  );
  const login = useCallback(
    (u: string, p: string) => authRequest('/auth/login', u, p),
    [authRequest],
  );

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
    setStats(null);
    setError(null);
    setStatus('anon');
  }, []);

  const refresh = useCallback(async () => {
    if (token) await loadMe(token);
  }, [token, loadMe]);

  return { status, user, token, stats, error, busy, register, login, logout, refresh };
}
