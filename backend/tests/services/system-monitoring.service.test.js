jest.mock('os', () => ({
  cpus: () => [{ times:{ user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } }],
  totalmem: () => 16 * 1024 * 1024 * 1024,
  freemem: () => 8 * 1024 * 1024 * 1024,
  loadavg: () => [0.5,0.4,0.3],
  uptime: () => 10000,
}));

const svc = require('../../src/services/system-monitoring.service');

describe('SystemMonitoringService', () => {
  test('collectMetrics and getHealthSummary', async () => {
    const m = await svc.collectMetrics();
    const h = await svc.getHealthSummary();
    expect(h).toHaveProperty('status');
  });

  test('start/stop monitoring toggles state', () => {
    expect(svc.startMonitoring(10)).toBe(true);
    expect(svc.stopMonitoring()).toBe(true);
  });

  test('exportMetricsCSV returns headers', async () => {
    const csv = await svc.exportMetricsCSV();
    expect(csv.split('\n')[0]).toContain('timestamp,cpu_usage');
  });
});