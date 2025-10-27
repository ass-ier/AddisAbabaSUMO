jest.mock('../../src/models/AuditLog', () => ({
  find: jest.fn(),
}));

const AuditLog = require('../../src/models/AuditLog');
const repo = require('../../src/repositories/audit.repository');

function chain(result){
  const q={ sort: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve(result)) })) };
  return q;
}

describe('AuditRepository more', () => {
  beforeEach(() => jest.clearAllMocks());

  test('findByRole and findByDateRange delegate to find', async () => {
    AuditLog.find.mockReturnValueOnce(chain([]));
    await repo.findByRole('admin', { limit: 1 });
    expect(AuditLog.find).toHaveBeenCalledWith({ role: 'admin' });

    AuditLog.find.mockReturnValueOnce(chain([]));
    await repo.findByDateRange('2020-01-01','2020-01-02',{ limit: 1 });
    expect(AuditLog.find).toHaveBeenCalled();
  });
});