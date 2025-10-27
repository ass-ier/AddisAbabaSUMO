jest.mock('../../src/services/traffic.service', () => ({
  getTrafficData: jest.fn(async () => ([
    { timestamp: new Date(Date.now() - 600000), vehicleCount: 40, averageSpeed: 8, intersectionId: 'A' },
    { timestamp: new Date(), vehicleCount: 20, averageSpeed: 12, intersectionId: 'B' },
  ])),
  getStatistics: jest.fn(async () => ({ count: 2, avgSpeed: 10, avgFlow: 100, avgVehicleCount: 30 })),
}));

jest.mock('../../src/services/system-monitoring.service', () => ({
  getHealthSummary: jest.fn(async () => ({ status: 'healthy', healthScore: 90, cpuUsage: 10, memoryUsage: 20, uptime: 10000, database: { connected: true }, sumo: { running: true } })),
  getMetrics: jest.fn(async () => ({ cpu: { usage: 10 }, memory: { usedGB: 4, totalGB: 16 }, database: { connected: true }, sumo: { running: true } })),
}));

jest.mock('../../src/services/cache.service', () => ({ get: jest.fn(() => null), set: jest.fn() }));

const svc = require('../../src/services/operator-analytics.service');

describe('OperatorAnalyticsService full surface', () => {
  test('traffic overview and congestion analysis', async () => {
    const overview = await svc.getTrafficOverview();
    expect(overview).toHaveProperty('averageSpeed');
    const cong = await svc.getCongestionAnalysis();
    expect(cong).toHaveProperty('overallLevel');
  });

  test('performance/system status/alerts', async () => {
    const perf = await svc.getPerformanceMetrics();
    expect(perf).toHaveProperty('efficiency');
    const status = await svc.getSystemStatus();
    expect(status).toHaveProperty('overallHealth');
    const alerts = await svc.getAlerts();
    expect(Array.isArray(alerts)).toBe(true);
  });

  test('traffic alerts and intersection analysis', async () => {
    const tAlerts = await svc.getTrafficAlerts();
    expect(Array.isArray(tAlerts)).toBe(true);
    const ia = await svc.getIntersectionAnalysis('A', '1h');
    expect(ia).toHaveProperty('intersectionId');
  });

  test('reports: daily/performance/system', async () => {
    const d = await svc.generateOperatorReport('daily', {});
    expect(d).toHaveProperty('type', 'daily');
    const p = await svc.generateOperatorReport('performance', {});
    expect(p).toHaveProperty('type', 'performance');
    const s = await svc.generateOperatorReport('system', {});
    expect(s).toHaveProperty('type', 'system');
  });
});