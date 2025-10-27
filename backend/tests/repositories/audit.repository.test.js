jest.mock('../../src/models/AuditLog', () => ({
  create: jest.fn((d) => Promise.resolve({ _id: 'a1', ...d })),
  find: jest.fn(),
  countDocuments: jest.fn(() => Promise.resolve(0)),
}));

const AuditLog = require('../../src/models/AuditLog');
const repo = require('../../src/repositories/audit.repository');

function chain(result){
  const q={ _calls:{ sort:[], limit:[] }, sort(a){ this._calls.sort.push(a); return this; }, limit(n){ this._calls.limit.push(parseInt(n)); return this; }, then(r){ return Promise.resolve(r(result)); } };
  return q;
}

describe('AuditRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  test('find applies sort and limit', async () => {
    const q = chain([{ _id: 'a1' }]);
    AuditLog.find.mockReturnValueOnce(q);
    const res = await repo.find({ user: 'u' }, { limit: 5, sort: { time: -1 } });
    expect(AuditLog.find).toHaveBeenCalledWith({ user: 'u' });
    expect(q._calls.sort[0]).toEqual({ time: -1 });
    expect(q._calls.limit[0]).toBe(5);
    expect(res.length).toBe(1);
  });

  test('findByUser delegates to find', async () => {
    const q = chain([]);
    AuditLog.find.mockReturnValueOnce(q);
    await repo.findByUser('bob', { limit: 1 });
    expect(AuditLog.find).toHaveBeenCalledWith({ user: 'bob' });
  });
});