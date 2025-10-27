jest.mock('../../src/services/cache.service', () => ({ get: jest.fn(), set: jest.fn() }));
jest.mock('../../src/services/system-monitoring.service', () => ({ getHealthSummary: jest.fn(() => Promise.resolve({ status:'healthy', cpu:10, memory:10 })), getMetrics: jest.fn(() => Promise.resolve({ uptime:100 })) }));

const cache = require('../../src/services/cache.service');
const svc = require('../../src/services/operator-analytics.service');

describe('OperatorAnalyticsService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getDashboardMetrics returns cached when present', async () => {
    cache.get.mockResolvedValueOnce({ cached:true });
    const r = await svc.getDashboardMetrics();
    expect(r.cached).toBe(true);
  });

  test('generateOperatorReport unknown type throws', async () => {
    await expect(svc.generateOperatorReport('unknown', {})).rejects.toThrow('Unknown report type');
  });
});