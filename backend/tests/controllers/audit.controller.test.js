jest.mock('../../src/services/audit.service', () => ({
  getAuditLogs: jest.fn(),
  exportToCSV: jest.fn(),
}));

const svc = require('../../src/services/audit.service');
const controller = require('../../src/controllers/audit.controller');

function res(){ return { statusCode:200, headers:{}, setHeader(k,v){ this.headers[k]=v; }, json: jest.fn(), status(c){ this.statusCode=c; return this; }, send: jest.fn() }; }

describe('AuditController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getAuditLogs returns data', async () => {
    svc.getAuditLogs.mockResolvedValueOnce({ items: [] });
    const r = res();
    await controller.getAuditLogs({ query: {} }, r);
    expect(r.json).toHaveBeenCalledWith({ items: [] });
  });

  test('exportAuditLogsCSV sets headers', async () => {
    svc.exportToCSV.mockResolvedValueOnce('csv');
    const r = res();
    await controller.exportAuditLogsCSV({ query: {} }, r);
    expect(r.headers['Content-Type']).toContain('text/csv');
    expect(r.send).toHaveBeenCalledWith('csv');
  });
});