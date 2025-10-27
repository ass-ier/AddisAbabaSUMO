jest.mock('../../src/services/stats.service', () => ({
  getKPIs: jest.fn(),
  getTrends: jest.fn(),
  getOverview: jest.fn(),
  getAdminStats: jest.fn(),
}));

const svc = require('../../src/services/stats.service');
const controller = require('../../src/controllers/stats.controller');

function res(){ return { statusCode: 200, body: undefined, status(c){ this.statusCode=c; return this; }, json(b){ this.body=b; return this; } }; }

describe('StatsController', () => {
  test('getKPIs forwards dates and returns json', async () => {
    svc.getKPIs.mockResolvedValueOnce({ uptime: 1 });
    const r = res();
    await controller.getKPIs({ query: {} }, r);
    expect(r.body).toHaveProperty('uptime');
  });

  test('getTrends returns json', async () => {
    svc.getTrends.mockResolvedValueOnce({ daily: [] });
    const r = res();
    await controller.getTrends({ query: {} }, r);
    expect(r.body.daily).toEqual([]);
  });

  test('getOverview returns json', async () => {
    svc.getOverview.mockResolvedValueOnce({ systemHealth: 80 });
    const r = res();
    await controller.getOverview({}, r);
    expect(r.body.systemHealth).toBe(80);
  });

  test('getAdminStats returns json', async () => {
    svc.getAdminStats.mockResolvedValueOnce({ userCount: 5 });
    const r = res();
    await controller.getAdminStats({}, r);
    expect(r.body.userCount).toBe(5);
  });

  test('error paths map to 500', async () => {
    svc.getKPIs.mockRejectedValueOnce(new Error('x'));
    const r = res();
    await controller.getKPIs({ query: {} }, r);
    expect(r.statusCode).toBe(500);
  });
});