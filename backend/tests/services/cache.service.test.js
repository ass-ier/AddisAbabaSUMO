const cache = require('../../src/services/cache.service');

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('CacheService (memory fallback)', () => {
  beforeAll(() => {
    cache.init(null); // ensure memory mode
  });

  test('set/get returns stored value', async () => {
    const ok = await cache.set('k1', { a: 1 }, 1);
    expect(ok).toBe(true);

    const v = await cache.get('k1');
    expect(v).toEqual({ a: 1 });
  });

  test('respects TTL expiration', async () => {
    await cache.set('k2', 'x', 1); // 1s
    await wait(1100);
    const v = await cache.get('k2');
    expect(v).toBeNull();
  });

  test('del removes key', async () => {
    await cache.set('k3', 123, 60);
    await cache.del('k3');
    const v = await cache.get('k3');
    expect(v).toBeNull();
  });

  test('delPattern removes matched keys', async () => {
    await cache.set('user:1', 1, 60);
    await cache.set('user:2', 2, 60);
    await cache.set('post:1', 3, 60);

    const n = await cache.delPattern('user:*');
    expect(n).toBe(2);

    expect(await cache.get('user:1')).toBeNull();
    expect(await cache.get('user:2')).toBeNull();
    expect(await cache.get('post:1')).toBe(3);
  });
});