const cache = require('../../src/services/cache.service');

describe('CacheService error paths', () => {
  test('get handles redis errors', async () => {
    const badClient = { get: async () => { throw new Error('boom'); } };
    cache.init(badClient);
    const v = await cache.get('x');
    expect(v).toBeNull();
  });

  test('set handles redis errors', async () => {
    const badClient = { setex: async () => { throw new Error('boom'); }, set: async () => { throw new Error('boom'); } };
    cache.init(badClient);
    const ok = await cache.set('x', 1, 10);
    expect(ok).toBe(false);
  });

  test('delPattern handles redis errors gracefully', async () => {
    const badClient = { keys: async () => { throw new Error('boom'); }, del: async () => 0 };
    cache.init(badClient);
    const n = await cache.delPattern('user:*');
    expect(n).toBeGreaterThanOrEqual(0);
  });
});