const cache = require('../../src/services/cache.service');

describe('CacheService with fake Redis client', () => {
  let client;
  beforeEach(() => {
    const store = new Map();
    client = {
      async get(k){ return store.get(k) || null; },
      async setex(k, ttl, v){ store.set(k, v); },
      async set(k, v){ store.set(k, v); },
      async del(...keys){ let n=0; keys.forEach(k=>{ if(store.delete(k)) n++; }); return n; },
      async keys(pattern){ const re = new RegExp('^' + pattern.replace('*','.*') + '$'); return [...store.keys()].filter(k=>re.test(k)); },
      async flushdb(){ store.clear(); },
    };
    cache.init(client);
  });

  test('set/get via Redis', async () => {
    await cache.set('rk', { x: 1 }, 10);
    const v = await cache.get('rk');
    expect(v).toEqual({ x: 1 });
  });

  test('delPattern via Redis', async () => {
    await cache.set('user:1', 1, 10);
    await cache.set('user:2', 2, 10);
    await cache.set('post:1', 3, 10);
    const n = await cache.delPattern('user:*');
    expect(n).toBe(2);
  });

  test('clear and stats', async () => {
    await cache.set('a', 1, 10);
    await cache.clear();
    const stats = cache.getStats();
    expect(stats.redisConnected).toBe(true);
  });
});