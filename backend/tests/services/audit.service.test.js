jest.mock('../../src/repositories/audit.repository', () => ({
  create: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../../src/services/cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

const repo = require('../../src/repositories/audit.repository');
const cache = require('../../src/services/cache.service');
const service = require('../../src/services/audit.service');

describe('AuditService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('record maps action to category and calls repo', async () => {
    await service.record({ username: 'a', role: 'analyst' }, 'user_update', 'target', { meta: 1 });
    expect(repo.create).toHaveBeenCalled();
  });

  test('getAuditLogs returns cached result', async () => {
    cache.get.mockResolvedValueOnce({ items: [1] });
    const r = await service.getAuditLogs({ user: 'a' });
    expect(r.items).toEqual([1]);
  });

  test('getAuditLogs queries, caches and returns', async () => {
    cache.get.mockResolvedValueOnce(null);
    repo.find.mockResolvedValueOnce([{ time: new Date().toISOString() }]);
    const r = await service.getAuditLogs({ limit: 1 });
    expect(cache.set).toHaveBeenCalled();
    expect(r.items.length).toBe(1);
  });

  test('exportToCSV builds CSV with headers', async () => {
    const now = new Date();
    repo.find.mockResolvedValueOnce([
      { time: now, user: 'u', role: 'r', action: 'a', target: 't' },
    ]);
    const csv = await service.exportToCSV({});
    expect(csv.split('\n')[0]).toBe('time,user,role,action,target');
    expect(csv).toContain('u,r,a,t');
  });
});