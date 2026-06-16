import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../storage/memory';
import {
  registerUser,
  loginUser,
  verifyToken,
  AuthError,
} from '../auth';

describe('contas e autenticação', () => {
  let store: MemoryStorage;
  beforeEach(() => {
    store = new MemoryStorage();
  });

  it('regista um utilizador e devolve um token válido', async () => {
    const { token, user } = await registerUser(store, 'Leca', 'segredo123');
    expect(user.username).toBe('Leca');
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(user.id);
    expect(payload!.username).toBe('Leca');
  });

  it('não deixa registar o mesmo nome duas vezes (sem distinguir maiúsculas)', async () => {
    await registerUser(store, 'Leca', 'segredo123');
    await expect(registerUser(store, 'leca', 'outra123')).rejects.toBeInstanceOf(AuthError);
  });

  it('rejeita nomes e palavras-passe inválidos', async () => {
    await expect(registerUser(store, 'ab', 'segredo123')).rejects.toBeInstanceOf(AuthError);
    await expect(registerUser(store, 'Valido', '123')).rejects.toBeInstanceOf(AuthError);
  });

  it('faz login com as credenciais certas (nome sem distinguir maiúsculas)', async () => {
    await registerUser(store, 'Leca', 'segredo123');
    const { user } = await loginUser(store, 'LECA', 'segredo123');
    expect(user.username).toBe('Leca');
  });

  it('falha o login com palavra-passe errada', async () => {
    await registerUser(store, 'Leca', 'segredo123');
    await expect(loginUser(store, 'Leca', 'errada')).rejects.toBeInstanceOf(AuthError);
  });

  it('rejeita tokens inválidos', () => {
    expect(verifyToken('lixo.token.invalido')).toBeNull();
  });
});

describe('estatísticas e ranking', () => {
  it('acumula resultados de partidas e ordena o ranking', async () => {
    const store = new MemoryStorage();
    const a = await registerUser(store, 'Ana', 'segredo123');
    const b = await registerUser(store, 'Beto', 'segredo123');
    const c = await registerUser(store, 'Caro', 'segredo123');

    // Jogo 1: Beto perde (chega a 100)
    await store.recordMatch([
      { userId: a.user.id, finalScore: 60, lost: false, salemas: 2, moons: 0 },
      { userId: b.user.id, finalScore: 105, lost: true, salemas: 1, moons: 0 },
      { userId: c.user.id, finalScore: 80, lost: false, salemas: 0, moons: 1 },
    ]);
    // Jogo 2: Caro perde
    await store.recordMatch([
      { userId: a.user.id, finalScore: 40, lost: false, salemas: 1, moons: 0 },
      { userId: b.user.id, finalScore: 70, lost: false, salemas: 0, moons: 0 },
      { userId: c.user.id, finalScore: 110, lost: true, salemas: 3, moons: 0 },
    ]);

    const statsA = await store.getStats(a.user.id);
    expect(statsA).toMatchObject({ gamesPlayed: 2, defeats: 0, totalPoints: 100, salemas: 3, moons: 0 });

    const ranking = await store.getRanking();
    // Ana: 2 jogos, 0 derrotas -> winRate 1.0 -> 1º
    expect(ranking[0].username).toBe('Ana');
    expect(ranking[0].rank).toBe(1);
    expect(ranking[0].winRate).toBeCloseTo(1);
    expect(ranking[0].avgPoints).toBeCloseTo(50);
    // Beto e Caro têm 1 derrota em 2 (winRate 0.5); desempata a média de pontos (menor é melhor)
    // Beto média (105+70)/2=87.5 ; Caro (80+110)/2=95 -> Beto à frente
    expect(ranking[1].username).toBe('Beto');
    expect(ranking[2].username).toBe('Caro');
    expect(ranking[1].rank).toBe(2);
    expect(ranking[2].rank).toBe(3);
  });

  it('só mostra no ranking quem já jogou', async () => {
    const store = new MemoryStorage();
    await registerUser(store, 'Novato', 'segredo123');
    expect(await store.getRanking()).toHaveLength(0);
  });
});
