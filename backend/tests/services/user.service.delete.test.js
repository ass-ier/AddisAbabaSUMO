jest.mock('../../src/repositories/user.repository', () => ({
  findById: jest.fn(),
  delete: jest.fn(() => Promise.resolve({ _id:'u1' })),
  updateLastLogin: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../src/services/cache.service', () => ({ del: jest.fn() }));

const userService = require('../../src/services/user.service');
const repo = require('../../src/repositories/user.repository');
const cache = require('../../src/services/cache.service');

describe('UserService delete/updateLastLogin branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deleteUser throws when not found', async () => {
    repo.findById.mockResolvedValueOnce(null);
    await expect(userService.deleteUser('u1', { _id:'admin', role:'super_admin' })).rejects.toThrow('User not found');
  });

  test('deleteUser success invalidates caches', async () => {
    repo.findById.mockResolvedValueOnce({ _id:'u1', username:'a', role:'analyst' });
    await userService.deleteUser('u1', { _id:'admin', role:'super_admin' });
    expect(cache.del).toHaveBeenCalledWith('user:u1');
    expect(cache.del).toHaveBeenCalledWith('users:list');
  });

  test('updateLastLogin not found', async () => {
    repo.updateLastLogin.mockResolvedValueOnce(null);
    await expect(userService.updateLastLogin('u2')).rejects.toThrow('User not found');
  });
});