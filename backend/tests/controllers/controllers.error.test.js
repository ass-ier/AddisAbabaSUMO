jest.mock('../../src/services/traffic.service', () => ({
  exportToCSV: jest.fn(() => { throw new Error('x'); }),
}));

jest.mock('../../src/services/audit.service', () => ({
  getAuditLogs: jest.fn(() => { throw new Error('x'); }),
}));

const trafficController = require('../../src/controllers/traffic.controller');
const auditController = require('../../src/controllers/audit.controller');

function res(){ return { statusCode:200, headers:{}, setHeader(k,v){ this.headers[k]=v; }, json: jest.fn(), status(c){ this.statusCode=c; return this; }, send: jest.fn() }; }

describe('Controllers error paths', () => {
  test('traffic export CSV error -> 500', async () => {
    const r = res();
    await trafficController.exportTrafficDataCSV({ query:{} }, r);
    expect(r.statusCode).toBe(500);
  });

  test('audit get logs error -> 500', async () => {
    const r = res();
    await auditController.getAuditLogs({ query:{} }, r);
    expect(r.statusCode).toBe(500);
  });
});