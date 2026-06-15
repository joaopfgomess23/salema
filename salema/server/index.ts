import http from 'http';
import { createRequire } from 'module';
import { SalemaRoom } from './SalemaRoom';

// O colyseus 0.15 é CommonJS; carregamo-lo com require (mantendo os tipos).
const require = createRequire(import.meta.url);
const { Server } = require('colyseus') as typeof import('colyseus');
const { WebSocketTransport } =
  require('@colyseus/ws-transport') as typeof import('@colyseus/ws-transport');

const port = Number(process.env.PORT) || 2567;

// Servidor HTTP com CORS (para o frontend poder estar noutro domínio) e uma
// rota de saúde simples. IMPORTANTE: só respondemos às NOSSAS rotas; tudo o
// resto (ex.: /matchmake/...) é deixado para o Colyseus tratar.
const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Salema online OK');
    return;
  }
  // Não terminamos a resposta: o Colyseus (express) trata do resto.
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('salema', SalemaRoom);

gameServer.listen(port);
console.log(`🃏 Salema online à escuta em http://localhost:${port}`);
