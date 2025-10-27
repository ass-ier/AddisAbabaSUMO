jest.mock('../../src/models/SumoLog', () => ({
  createEntry: jest.fn((d,u) => Promise.resolve({ _id: 's1', ...d, username: u.username })),
  getRecentLogs: jest.fn(() => Promise.resolve([{ _id:'1', timestamp:new Date(), username:'u', userFullName:'U', type:'warning', category:'simulation_control' }])),
  deleteMany: jest.fn(() => Promise.resolve({ deletedCount: 2 })),
  aggregate: jest.fn(() => Promise.resolve([{ total: 2, info: 1, success: 0, warning: 1, error: 0, byCategory:['simulation_control'], byUser:['u'], latestTimestamp: new Date() }]))
}));

const SumoLog = require('../../src/models/SumoLog');
const svc = require('../../src/services/sumo-logs.service');

describe('SumoLogsService', () => {
  test('createLog delegates to model', async () => {
    const entry = await svc.createLog({ message:'m', action:'start' }, { username:'alice' });
    expect(entry._id).toBe('s1');
  });

  test('getLogs formats output', async () => {
    const res = await svc.getLogs({}, { username:'bob', role:'user' });
    expect(res.logs[0]).toHaveProperty('timeAgo');
    expect(res.logs[0]).toHaveProperty('isImportant', true);
  });

  test('clearLogs deletes for user', async () => {
    const r = await svc.clearLogs({ username:'bob', role:'user' });
    expect(r.scope).toBe('user');
  });

  test('getLogStats aggregates', async () => {
    const r = await svc.getLogStats({ username:'bob', role:'user' });
    expect(r.total).toBe(2);
    expect(r.uniqueCategories).toBeGreaterThanOrEqual(1);
  });
});