jest.mock('../../src/models/TrafficData', () => ({
  create: jest.fn((d) => Promise.resolve({ _id: 't1', ...d })),
  find: jest.fn(),
  countDocuments: jest.fn(() => Promise.resolve(0)),
  deleteMany: jest.fn(() => Promise.resolve({ deletedCount: 1 })),
}));

const TrafficData = require('../../src/models/TrafficData');
const repo = require('../../src/repositories/traffic.repository');

function chain(result){
  const q={ _calls:{ sort:[], limit:[] }, sort(a){ this._calls.sort.push(a); return this; }, limit(n){ this._calls.limit.push(parseInt(n)); return this; }, then(r){ return Promise.resolve(r(result)); } };
  return q;
}

describe('TrafficRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  test('find applies sort and limit', async () => {
    const q = chain([{ _id: 't1' }]);
    TrafficData.find.mockReturnValueOnce(q);
    const res = await repo.find({ a: 1 }, { limit: 5, sort: { timestamp: -1 } });
    expect(TrafficData.find).toHaveBeenCalledWith({ a: 1 });
    expect(q._calls.sort[0]).toEqual({ timestamp: -1 });
    expect(q._calls.limit[0]).toBe(5);
    expect(res.length).toBe(1);
  });

  test('countRecent builds time window', async () => {
    await repo.countRecent(10);
    expect(TrafficData.countDocuments).toHaveBeenCalled();
  });

  test('deleteOlderThan calls deleteMany', async () => {
    await repo.deleteOlderThan(new Date());
    expect(TrafficData.deleteMany).toHaveBeenCalled();
  });
});