jest.mock('../../src/models/User', () => ({
  findByIdAndUpdate: jest.fn(() => ({ select: jest.fn().mockReturnThis(), then: (r)=>Promise.resolve(r({ _id:'u', role:'analyst' })) })),
  find: jest.fn(() => ({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), then: (r)=>Promise.resolve(r([{ _id:'u' }])) })),
  countDocuments: jest.fn(() => Promise.resolve(1)),
}));

const User = require('../../src/models/User');
const repo = require('../../src/repositories/user.repository');

describe('UserRepository more', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updateLastLogin calls findByIdAndUpdate', async () => {
    await repo.updateLastLogin('u');
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });

  test('findByRole, findOperators, findAdmins, findPrivilegedUsers', async () => {
    await repo.findByRole('analyst');
    expect(User.find).toHaveBeenCalled();

    await repo.findOperators(true);
    expect(User.find).toHaveBeenCalled();

    await repo.findAdmins(true);
    expect(User.find).toHaveBeenCalled();

    await repo.findPrivilegedUsers(false);
    expect(User.find).toHaveBeenCalled();
  });

  test('updateRole and softDelete', async () => {
    await repo.updateRole('u','super_admin');
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    await repo.softDelete('u');
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });
});