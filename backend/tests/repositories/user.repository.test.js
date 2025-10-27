jest.mock('../../src/models/User', () => ({
  findById: jest.fn(() => ({ select: jest.fn().mockReturnThis(), then: function(r){ return Promise.resolve(r({ _id: 'u1' })); } })),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(() => ({ select: jest.fn().mockReturnThis(), then: (res)=>Promise.resolve(res({ _id: 'u1' })) })),
  findByIdAndDelete: jest.fn(() => Promise.resolve({ _id: 'u1' })),
  find: jest.fn(),
  countDocuments: jest.fn(() => Promise.resolve(0)),
  aggregate: jest.fn(() => Promise.resolve([{ _id: 'super_admin', count: 2 }, { _id: 'admin', count: 1 }])),
}));

const User = require('../../src/models/User');
const repo = require('../../src/repositories/user.repository');

function makeThenable(result) {
  const obj = {
    _calls: { select: [], sort: [], limit: [], skip: [] },
    select(arg) { this._calls.select.push(arg); return this; },
    sort(arg) { this._calls.sort.push(arg); return this; },
    limit(arg) { this._calls.limit.push(arg); return this; },
    skip(arg) { this._calls.skip.push(arg); return this; },
    then(resolve) { return Promise.resolve(resolve(result)); }
  };
  return obj;
}

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findByUsername lowercases and excludes password by default', async () => {
    const q = makeThenable({ _id: 'u1', username: 'alice' });
    const selectSpy = jest.spyOn(q, 'select');
    User.findOne.mockReturnValueOnce(q);

    const user = await repo.findByUsername('Alice');
    expect(User.findOne).toHaveBeenCalledWith({ username: 'alice' });
    expect(selectSpy).toHaveBeenCalledWith('-password');
    expect(user.username).toBe('alice');
  });

  test('findAll applies select, sort, limit, skip', async () => {
    const q = makeThenable([{ _id: 'u1' }]);
    const sortSpy = jest.spyOn(q, 'sort');
    const limitSpy = jest.spyOn(q, 'limit');
    const skipSpy = jest.spyOn(q, 'skip');
    User.find.mockReturnValueOnce(q);

    const res = await repo.findAll({ role: 'analyst' }, { limit: 10, skip: 20, sort: { createdAt: -1 } });
    expect(User.find).toHaveBeenCalledWith({ role: 'analyst' });
    expect(sortSpy).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limitSpy).toHaveBeenCalledWith(10);
    expect(skipSpy).toHaveBeenCalledWith(20);
    expect(Array.isArray(res)).toBe(true);
  });

  test('exists checks countDocuments > 0', async () => {
    User.countDocuments.mockResolvedValueOnce(2);
    const ex = await repo.exists('Alice');
    expect(User.countDocuments).toHaveBeenCalledWith({ username: 'alice' });
    expect(ex).toBe(true);
  });

  test('getRoleStatistics aggregates and maps', async () => {
    const stats = await repo.getRoleStatistics();
    expect(stats.total).toBe(3);
    expect(stats.super_admin).toBe(2);
    expect(stats.admin).toBe(1);
  });
});