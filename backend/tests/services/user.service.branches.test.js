jest.mock('../../src/repositories/user.repository', () => ({
  findById: jest.fn(),
  findByUsername: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  exists: jest.fn(),
  updateLastLogin: jest.fn(),
  findByRole: jest.fn(),
}));

jest.mock('../../src/services/cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const userService = require('../../src/services/user.service');
const repo = require('../../src/repositories/user.repository');
const cache = require('../../src/services/cache.service');

describe('UserService branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createUser happy path', async () => {
    repo.findByUsername.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce({ _id:'u1', username:'alice', role:'analyst' });
    const u = await userService.createUser({ username:'Alice', password:'secret', role:'analyst', email:'e@x.com', firstName:'f', lastName:'l' });
    expect(cache.del).toHaveBeenCalledWith('users:list');
    expect(u.username).toBe('alice');
  });

  test('getUserById cache miss then set', async () => {
    cache.get.mockResolvedValueOnce(null);
    repo.findById.mockResolvedValueOnce({ _id:'u1', username:'a' });
    const u = await userService.getUserById('u1');
    expect(cache.set).toHaveBeenCalled();
    expect(u._id).toBe('u1');
  });

  test('getUserById not found', async () => {
    cache.get.mockResolvedValueOnce(null);
    repo.findById.mockResolvedValueOnce(null);
    await expect(userService.getUserById('bad')).rejects.toThrow('User not found');
  });

  test('getAllUsers default cached path', async () => {
    cache.get.mockResolvedValueOnce(null);
    repo.count.mockResolvedValueOnce(1);
    repo.findByRole.mockResolvedValueOnce([{ _id:'u1', username:'a' }]);
    const res = await userService.getAllUsers({}, { page:1, limit:20, sort:{ createdAt: -1 } });
    expect(cache.set).toHaveBeenCalled();
    expect(res.total).toBe(1);
  });

  test('updateUser disallow role change by non-super_admin', async () => {
    repo.findById.mockResolvedValueOnce({ _id:'u2', username:'b', role:'analyst' });
    await expect(userService.updateUser('u2', { role:'super_admin' }, { _id:'me', role:'analyst' })).rejects.toThrow('Only super admins can change user roles');
  });

  test('updateUser self-only for non-admins', async () => {
    repo.findById.mockResolvedValueOnce({ _id:'u2', username:'b', role:'analyst' });
    await expect(userService.updateUser('u2', { region:'x' }, { _id:'me', role:'analyst' })).rejects.toThrow('own profile');
  });

  test('updateUser password too short', async () => {
    repo.findById.mockResolvedValueOnce({ _id:'me', username:'b', role:'analyst' });
    await expect(userService.updateUser('me', { password:'123' }, { _id:'me', role:'analyst' })).rejects.toThrow('at least 6');
  });

  test('updateUser username conflict', async () => {
    repo.findById.mockResolvedValueOnce({ _id:'u2', username:'b', role:'analyst' });
    repo.exists.mockResolvedValueOnce(true);
    await expect(userService.updateUser('u2', { username:'alice' }, { _id:'u2', role:'analyst' })).rejects.toThrow('already exists');
  });

  test('deleteUser self delete forbidden', async () => {
    await expect(userService.deleteUser('me', { _id:'me', role:'super_admin' })).rejects.toThrow('cannot delete your own');
  });

  test('deleteUser requires super_admin', async () => {
    await expect(userService.deleteUser('u1', { _id:'me', role:'analyst' })).rejects.toThrow('Only super admins can delete users');
  });

  test('getUserCount caches result', async () => {
    cache.get.mockResolvedValueOnce(5);
    const n = await userService.getUserCount();
    expect(n).toBe(5);
  });
});