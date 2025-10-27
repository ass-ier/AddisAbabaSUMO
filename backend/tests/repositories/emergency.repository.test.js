jest.mock('../../src/models/Emergency', () => ({
  create: jest.fn((d) => Promise.resolve({ _id: 'e1', ...d })),
  findById: jest.fn(() => Promise.resolve({ _id: 'e1' })),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(() => Promise.resolve({ _id: 'e1', active: false })),
  findByIdAndDelete: jest.fn(() => Promise.resolve({ _id: 'e1' })),
  countDocuments: jest.fn(() => Promise.resolve(0)),
}));

const Emergency = require('../../src/models/Emergency');
const repo = require('../../src/repositories/emergency.repository');

function chain(result){
  const q={ _calls:{ sort:[] }, sort(a){ this._calls.sort.push(a); return this; }, then(r){ return Promise.resolve(r(result)); } };
  return q;
}

describe('EmergencyRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  test('findActive sorts by createdAt desc', async () => {
    const q = chain([{ _id: 'e1' }]);
    Emergency.find.mockReturnValueOnce(q);
    const res = await repo.findActive();
    expect(q._calls.sort[0]).toEqual({ createdAt: -1 });
    expect(res.length).toBe(1);
  });

  test('findAll applies sort and limit', async () => {
    const q = { sort: () => ({ limit: (n) => Promise.resolve([{ _id: 'e1' }]) }) };
    Emergency.find.mockReturnValueOnce(q);
    const res = await repo.findAll({ limit: 10 });
    expect(res.length).toBe(1);
  });
});