// Teste de integração do servidor online: 2 humanos + 3 bots, mesma sala,
// partida a correr até ao fim com perdedores válidos.
import { spawn } from 'child_process';
import { Client } from 'colyseus.js';

const PORT = 2599;
const ENDPOINT = `ws://localhost:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = spawn('npx', ['tsx', 'server/index.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT), SALEMA_BOT_DELAY: '1', SALEMA_TRICK_PAUSE: '1', SALEMA_HAND_REVIEW: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let ready = false;
srv.stdout.on('data', (d) => { if (String(d).includes('à escuta')) ready = true; });
srv.stderr.on('data', (d) => process.stderr.write('[srv] ' + d));

function autoPlayer(room, name) {
  return new Promise((resolve, reject) => {
    room.onMessage('view', (v) => {
      if (v.type !== 'state') return;
      if (v.yourTurn && v.legalCardIds.length) {
        room.send('play', { cardId: v.legalCardIds[0] });
      }
      if (v.phase === 'matchComplete') {
        resolve({ name, roomId: room.roomId, losers: v.losers, scores: v.players.map((p) => p.score) });
      }
    });
    room.onError((c, m) => reject(new Error(`erro de sala (${name}): ${c} ${m}`)));
  });
}

async function run() {
  for (let i = 0; i < 50 && !ready; i++) await wait(100);
  if (!ready) throw new Error('servidor não arrancou');
  await wait(300);

  const ana = new Client(ENDPOINT);
  const roomA = await ana.joinOrCreate('salema', { name: 'Ana' });
  const beto = new Client(ENDPOINT);
  const roomB = await beto.joinById(roomA.roomId, { name: 'Beto' }); // mesma sala, garantido
  const pA = autoPlayer(roomA, 'Ana');
  const pB = autoPlayer(roomB, 'Beto');
  await wait(300);
  roomA.send('start'); // preenche com 3 bots e começa

  const timeout = wait(25000).then(() => { throw new Error('timeout: jogo não terminou em 25s'); });
  const [ra, rb] = await Promise.race([Promise.all([pA, pB]), timeout]);

  console.log('A:', JSON.stringify(ra));
  console.log('B:', JSON.stringify(rb));
  if (ra.roomId !== rb.roomId) throw new Error('jogadores em salas diferentes');
  if (!ra.losers || ra.losers.length === 0) throw new Error('sem perdedores no fim');
  if (!ra.losers.every((p) => ra.scores[p] >= 100)) throw new Error('perdedor com < 100 pontos');
  if (JSON.stringify(ra.losers) !== JSON.stringify(rb.losers)) throw new Error('os dois clientes viram resultados diferentes');
  console.log('OK — 2 humanos + 3 bots, mesma sala, jogo terminou com perdedores corretos e consistentes.');
}

run().then(() => { srv.kill(); process.exit(0); })
     .catch((e) => { console.error('FALHA:', e.message); srv.kill(); process.exit(1); });
