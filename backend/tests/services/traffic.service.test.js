jest.mock('../../src/repositories/traffic.repository', () => ({
  create: jest.fn(),
  findByIntersectionAndDateRange: jest.fn(),
  findByIntersection: jest.fn(),
  findByDateRange: jest.fn(),
  getLatest: jest.fn(),
  countRecent: jest.fn(),
}));

jest.mock('../../src/services/cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
  deletePattern: jest.fn(),
}));

const repo = require('../../src/repositories/traffic.repository');
const cache = require('../../src/services/cache.service');
const service = require('../../src/services/traffic.service');

describe('TrafficService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createTrafficData invalidates cache', async () => {
    repo.create.mockResolvedValueOnce({ _id: 't1' });
    const r = await service.createTrafficData({ intersectionId: 'X' });
    expect(cache.deletePattern).toHaveBeenCalledWith('traffic_data:X:*');
    expect(cache.deletePattern).toHaveBeenCalledWith('traffic_data:all:*');
    expect(r._id).toBe('t1');
  });

  test('getTrafficData cache hit', async () => {
    cache.get.mockResolvedValueOnce([{ id: 1 }]);
    const r = await service.getTrafficData({ intersectionId: 'A' });
    expect(r).toEqual([{ id: 1 }]);
    expect(repo.getLatest).not.toHaveBeenCalled();
  });

  test('getTrafficData chooses correct repo calls', async () => {
    cache.get.mockResolvedValue(null);
    // both
    repo.findByIntersectionAndDateRange.mockResolvedValueOnce([{ a: 1 }]);
    await service.getTrafficData({ intersectionId: 'I', startDate: 's', endDate: 'e', limit: 5 });
    expect(repo.findByIntersectionAndDateRange).toHaveBeenCalled();

    // intersection only
    repo.findByIntersection.mockResolvedValueOnce([{ b: 1 }]);
    await service.getTrafficData({ intersectionId: 'I' });
    expect(repo.findByIntersection).toHaveBeenCalled();

    // date range only
    repo.findByDateRange.mockResolvedValueOnce([{ c: 1 }]);
    await service.getTrafficData({ startDate: 's', endDate: 'e' });
    expect(repo.findByDateRange).toHaveBeenCalled();

    // neither => latest
    repo.getLatest.mockResolvedValueOnce([{ d: 1 }]);
    await service.getTrafficData({});
    expect(repo.getLatest).toHaveBeenCalled();
  });

  test('exportToCSV includes headers', async () => {
    repo.getLatest.mockResolvedValueOnce([
      { timestamp: new Date(0), intersectionId: 'I', trafficFlow: 1, vehicleCount: 2, averageSpeed: 3, signalStatus: 'g' }
    ]);
    const csv = await service.exportToCSV({});
    expect(csv.split('\n')[0]).toBe('timestamp,intersectionId,trafficFlow,vehicleCount,averageSpeed,signalStatus');
    expect(csv).toContain('I');
  });

  test('getStatistics empty returns zeros', async () => {
    repo.getLatest.mockResolvedValueOnce([]);
    cache.get.mockResolvedValueOnce(null);
    const r = await service.getStatistics({});
    expect(r).toEqual({ count: 0, avgSpeed: 0, avgFlow: 0, avgVehicleCount: 0 });
  });

  test('countRecent delegates to repo', async () => {
    repo.countRecent.mockResolvedValueOnce(7);
    const n = await service.countRecent(10);
    expect(n).toBe(7);
  });
});