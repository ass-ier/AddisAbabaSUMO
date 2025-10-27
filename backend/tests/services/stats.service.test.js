jest.mock('../../src/models/TrafficData', () => ({
  find: jest.fn(() => ({ sort: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve([])) })) })),
  countDocuments: jest.fn(() => Promise.resolve(0)),
}));

jest.mock('../../src/models/User', () => ({
  countDocuments: jest.fn(() => Promise.resolve(0)),
}));

jest.mock('../../src/models/Emergency', () => ({
  countDocuments: jest.fn(() => Promise.resolve(0)),
}));

jest.mock('../../src/models/SimulationStatus', () => ({
  findOne: jest.fn(() => ({ sort: jest.fn(() => Promise.resolve(null)) })),
}));

jest.mock('../../src/services/cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

const cache = require('../../src/services/cache.service');
const TrafficData = require('../../src/models/TrafficData');
const SimulationStatus = require('../../src/models/SimulationStatus');
const StatsService = require('../../src/services/stats.service');

const service = new StatsService.__proto__.constructor ? new (StatsService.__proto__.constructor)() : require('../../src/services/stats.service');

// If module.exports is instance, use that; otherwise instantiate
const statsService = typeof service.getKPIs === 'function' ? service : require('../../src/services/stats.service');

describe('StatsService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getKPIs returns from cache when present', async () => {
    cache.get.mockResolvedValueOnce({ uptime: 1 });
    const r = await statsService.getKPIs();
    expect(r.uptime).toBe(1);
  });

  test('getKPIs computes and caches when missing', async () => {
    cache.get.mockResolvedValueOnce(null);
    // Provide some data
    TrafficData.find.mockReturnValueOnce({
      sort: () => ({ limit: () => Promise.resolve([{ averageSpeed: 20 }, { averageSpeed: 30 }]) })
    });
    const r = await statsService.getKPIs();
    expect(r.avgSpeed).toBe(25.0);
    expect(cache.set).toHaveBeenCalled();
  });

  test('getTrends groups by day and caches', async () => {
    cache.get.mockResolvedValueOnce(null);
    const today = new Date();
    const y = new Date(Date.now() - 86400000);
    TrafficData.find.mockResolvedValueOnce([
      { timestamp: today, averageSpeed: 10, trafficFlow: 500 },
      { timestamp: today, averageSpeed: 30, trafficFlow: 1500 },
      { timestamp: y, averageSpeed: 20, trafficFlow: 200 },
    ]);
    const r = await statsService.getTrends();
    expect(r.daily.length).toBeGreaterThanOrEqual(1);
    expect(cache.set).toHaveBeenCalled();
  });

  test('getOverview returns cached when present', async () => {
    cache.get.mockResolvedValueOnce({ userCount: 5 });
    const r = await statsService.getOverview();
    expect(r.userCount).toBe(5);
  });

  test('getOverview computes and caches when missing', async () => {
    cache.get.mockResolvedValueOnce(null);
    const r = await statsService.getOverview();
    expect(cache.set).toHaveBeenCalled();
    expect(r).toHaveProperty('systemHealth');
  });

  test('getAdminStats aggregates counts and caches', async () => {
    cache.get.mockResolvedValueOnce(null);
    const r = await statsService.getAdminStats();
    expect(cache.set).toHaveBeenCalled();
    expect(r).toHaveProperty('userCount');
  });
});