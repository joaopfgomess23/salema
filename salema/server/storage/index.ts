import { Storage } from './types';
import { MemoryStorage } from './memory';

export * from './types';

/**
 * Escolhe a persistência: Postgres se existir DATABASE_URL (produção, ex. Neon),
 * caso contrário memória (desenvolvimento e testes). O adaptador Postgres só é
 * carregado quando é mesmo preciso.
 */
export async function createStorage(): Promise<Storage> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { PostgresStorage } = await import('./postgres');
    const store = new PostgresStorage(url);
    await store.init();
    console.log('🗄️  Estatísticas: Postgres');
    return store;
  }
  const store = new MemoryStorage();
  await store.init();
  console.log('🗄️  Estatísticas: memória (sem DATABASE_URL — não persiste)');
  return store;
}
