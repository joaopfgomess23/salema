import http from 'http';
import { createRequire } from 'module';
import { SalemaRoom, setStorage } from './SalemaRoom';
import { createStorage } from './storage';
import { registerUser, loginUser, AuthError, verifyToken } from './auth';

const require = createRequire(import.meta.url);
const { Server } = require('colyseus') as typeof import('colyseus');
const { WebSocketTransport } =
  require('@colyseus/ws-transport') as typeof import('@colyseus/ws-transport');

const port = Number(process.env.PORT) || 2567;

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 10_000) reject(new Error('corpo demasiado grande'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function main() {
  const storage = await createStorage();
  setStorage(storage);

  const httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = (req.url || '').split('?')[0];

    if (url === '/' || url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Salema online OK');
      return;
    }

    // ---- Contas ----
    if (url === '/auth/register' && req.method === 'POST') {
      try {
        const body = (await readJson(req)) as { username?: string; password?: string };
        const result = await registerUser(storage, body.username, body.password);
        sendJson(res, 200, result);
      } catch (e) {
        sendJson(res, e instanceof AuthError ? 400 : 500, {
          error: e instanceof Error ? e.message : 'Erro no registo.',
        });
      }
      return;
    }

    if (url === '/auth/login' && req.method === 'POST') {
      try {
        const body = (await readJson(req)) as { username?: string; password?: string };
        const result = await loginUser(storage, body.username, body.password);
        sendJson(res, 200, result);
      } catch (e) {
        sendJson(res, e instanceof AuthError ? 401 : 500, {
          error: e instanceof Error ? e.message : 'Erro no início de sessão.',
        });
      }
      return;
    }

    // ---- Sessão atual + estatísticas próprias ----
    if (url === '/me' && req.method === 'GET') {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const payload = verifyToken(token);
      if (!payload) {
        sendJson(res, 401, { error: 'Sessão inválida.' });
        return;
      }
      const stats = await storage.getStats(payload.userId);
      sendJson(res, 200, {
        user: { id: payload.userId, username: payload.username },
        stats,
      });
      return;
    }

    // ---- Ranking público ----
    if (url === '/ranking' && req.method === 'GET') {
      const ranking = await storage.getRanking(50);
      sendJson(res, 200, { ranking });
      return;
    }

    // Tudo o resto (ex.: /matchmake/...) é deixado para o Colyseus.
  });

  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
  });

  gameServer.define('salema', SalemaRoom, { mode: 'casual' });
  gameServer.define('salema_ranked', SalemaRoom, { mode: 'ranked' });

  gameServer.listen(port);
  console.log(`🃏 Salema online à escuta em http://localhost:${port}`);
}

main().catch((e) => {
  console.error('Falha a arrancar o servidor:', e);
  process.exit(1);
});
