jest.mock('../../src/services/operator-analytics.service', () => ({
  getDashboardMetrics: jest.fn(() => Promise.resolve({ ok:true })),
  getTrafficOverview: jest.fn(() => Promise.resolve({ overview:true })),
  getIntersectionAnalysis: jest.fn(() => Promise.resolve({ id:'X' })),
}));

jest.mock('../../src/services/system-monitoring.service', () => ({
  getHealthSummary: jest.fn(() => Promise.resolve({ status:'healthy' })),
  getMetrics: jest.fn(() => Promise.resolve({ timestamp: Date.now() })),
  getPerformanceStats: jest.fn(() => Promise.resolve({ avgCpu: 10 })),
  exportMetricsCSV: jest.fn(() => Promise.resolve('t,csv')),
  startMonitoring: jest.fn(() => true),
  stopMonitoring: jest.fn(() => true),
  collectMetrics: jest.fn(() => Promise.resolve({ collected:true })),
}));

jest.mock('../../src/services/emergency.service', () => ({
  getActiveEmergencies: jest.fn(() => Promise.resolve({ items: [] })),
}));

jest.mock('../../src/models/SimulationStatus', () => ({
  findOne: jest.fn(() => ({ sort: jest.fn(() => Promise.resolve(null)) })),
}));

jest.mock('../../src/services/cache.service', () => ({ clear: jest.fn(), delete: jest.fn(), del: jest.fn() }));

const operatorController = require('../../src/controllers/operator.controller');
const analytics = require('../../src/services/operator-analytics.service');
const monitoring = require('../../src/services/system-monitoring.service');

function res(){ return { statusCode:200, headers:{}, setHeader(k,v){ this.headers[k]=v; }, json: jest.fn(), status(c){ this.statusCode=c; return this; }, send: jest.fn() }; }

const baseReq = { user: { _id:'me', username:'me', role:'super_admin' }, body:{}, query:{}, params:{}, app:{} };

describe('OperatorController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('dashboard metrics', async () => {
    const r = res();
    await operatorController.getDashboardMetrics(baseReq, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('system health', async () => {
    const r = res();
    await operatorController.getSystemHealth(baseReq, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('system metrics with period', async () => {
    const r = res();
    await operatorController.getSystemMetrics({ ...baseReq, query:{ period: '6' } }, r);
    expect(monitoring.getPerformanceStats).toHaveBeenCalled();
  });

  test('export metrics csv', async () => {
    const r = res();
    await operatorController.exportSystemMetricsCSV(baseReq, r);
    expect(r.headers['Content-Type']).toContain('text/csv');
  });

  test('emergencies returns combined info', async () => {
    const r = res();
    await operatorController.getActiveEmergencies(baseReq, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('intersection analysis requires id', async () => {
    const r = res();
    await operatorController.getIntersectionAnalysis({ ...baseReq, params:{} }, r);
    expect(r.statusCode).toBe(400);
  });

  test('intersection analysis ok', async () => {
    const r = res();
    await operatorController.getIntersectionAnalysis({ ...baseReq, params:{ intersectionId:'I' } }, r);
    expect(analytics.getIntersectionAnalysis).toHaveBeenCalled();
  });

  test('reports generate daily', async () => {
    const r = res();
    await operatorController.generateReport({ ...baseReq, body:{ type:'daily', options:{} } }, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('start/stop monitoring', async () => {
    const r = res();
    await operatorController.systemMonitoringAction({ ...baseReq, params:{ action:'start' }, body:{ interval: 10 } }, r);
    expect(monitoring.startMonitoring).toHaveBeenCalled();
    await operatorController.systemMonitoringAction({ ...baseReq, params:{ action:'stop' } }, r);
    expect(monitoring.stopMonitoring).toHaveBeenCalled();
  });

  test('refresh_metrics command', async () => {
    const r = res();
    await operatorController.executeCommand({ ...baseReq, body:{ command:'refresh_metrics' } }, r);
    expect(monitoring.collectMetrics).toHaveBeenCalled();
  });
});