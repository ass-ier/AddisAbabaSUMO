jest.mock('../../src/services/sumo-logs.service', () => ({
  createLog: jest.fn(),
  getLogs: jest.fn(),
  clearLogs: jest.fn(),
  getLogStats: jest.fn(),
  bulkCreateLogs: jest.fn(),
}));

const svc = require('../../src/services/sumo-logs.service');
const controller = require('../../src/controllers/sumo-logs.controller');

function res(){ return { statusCode:200, json: jest.fn(), status(c){ this.statusCode=c; return this; }, send: jest.fn() }; }

const userCtx = { user: { username:'alice', role:'analyst' }, sessionID: 'sess1' };

describe('SumoLogsController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createLog success returns 201', async () => {
    svc.createLog.mockResolvedValueOnce({ _id:'1', message:'m' });
    const r = res();
    await controller.createLog({ body: { message:'hi' }, ...userCtx }, r);
    expect(r.statusCode).toBe(201);
  });

  test('getLogs returns data', async () => {
    svc.getLogs.mockResolvedValueOnce({ logs:[], total:0 });
    const r = res();
    await controller.getLogs({ query: {}, ...userCtx }, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('clearLogs returns message', async () => {
    svc.clearLogs.mockResolvedValueOnce({ deletedCount: 2, scope:'user' });
    const r = res();
    await controller.clearLogs(userCtx, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('getLogStats returns stats', async () => {
    svc.getLogStats.mockResolvedValueOnce({ total: 1 });
    const r = res();
    await controller.getLogStats(userCtx, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('bulkCreateLogs creates entries', async () => {
    svc.bulkCreateLogs.mockResolvedValueOnce([{ _id:'1' }, { _id:'2' }]);
    const r = res();
    await controller.bulkCreateLogs({ body: { logs:[{ message:'a' }] }, ...userCtx }, r);
    expect(r.statusCode).toBe(201);
  });
});