jest.mock('../../src/models/TrafficData', () => ({
  find: jest.fn(() => ({ sort: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve([])) })) })),
  countDocuments: jest.fn(() => { throw new Error('db down'); }),
}));

jest.mock('../../src/services/cache.service', () => ({ get: jest.fn(() => null), set: jest.fn() }));

const StatsService = require('../../src/services/stats.service');
const service = StatsService; // exported instance

describe('StatsService fallback path', () => {
  test('getOverview catch returns fallback', async () => {
    const r = await service.getOverview();
    expect(r).toHaveProperty('systemHealth');
  });
});