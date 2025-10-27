jest.mock('../../src/services/traffic.service', () => ({
  createTrafficData: jest.fn(),
  getTrafficData: jest.fn(),
  exportToCSV: jest.fn(),
  getStatistics: jest.fn(),
}));

const svc = require('../../src/services/traffic.service');
const controller = require('../../src/controllers/traffic.controller');

function res(){ return { app: {}, statusCode:200, headers:{}, setHeader(k,v){ this.headers[k]=v; }, json: jest.fn(), status(c){ this.statusCode=c; return this; }, send: jest.fn() }; }

describe('TrafficController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createTrafficData validates required fields', async () => {
    const r = res();
    await controller.createTrafficData({ body: {} }, r);
    expect(r.statusCode).toBe(400);
  });

  test('createTrafficData success emits socket and returns 201', async () => {
    svc.createTrafficData.mockResolvedValueOnce({ _id:'t1' });
    const r = res();
    const fakeIo = { emit: jest.fn() };
    r.app.io = fakeIo;
    await controller.createTrafficData({ body: { intersectionId:'I', trafficFlow:1, signalStatus:'g' }, app: r.app }, r);
    expect(r.statusCode).toBe(201);
    expect(r.json).toHaveBeenCalled();
    expect(fakeIo.emit).toHaveBeenCalled();
  });

  test('getTrafficData returns array', async () => {
    svc.getTrafficData.mockResolvedValueOnce([{ a:1 }]);
    const r = res();
    await controller.getTrafficData({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith([{ a:1 }]);
  });

  test('exportTrafficDataCSV sets headers and sends', async () => {
    svc.exportToCSV.mockResolvedValueOnce('a,b\n');
    const r = res();
    await controller.exportTrafficDataCSV({ query: {} }, r);
    expect(r.headers['Content-Type']).toContain('text/csv');
    expect(r.send).toHaveBeenCalledWith('a,b\n');
  });

  test('getStatistics returns json', async () => {
    svc.getStatistics.mockResolvedValueOnce({ count: 1 });
    const r = res();
    await controller.getStatistics({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith({ count: 1 });
  });
});