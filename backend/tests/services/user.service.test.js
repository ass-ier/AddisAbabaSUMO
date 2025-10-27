jest.mock('../../src/repositories/user.repository', () => ({
  findById: jest.fn(),
  findByUsername: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  updateLastLogin: jest.fn(),
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

describe('UserService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createUser rejects duplicate username', async () => {
repo.findByUsername.mockResolvedValueOnce({ _id: 'existing' });
await expect(userService.createUser({ username: 'Alice', password: 'secret' })).rejects.toThrow('Username already exists');
  });

  test('verifyCredentials validates password and updates last login', async () => {
    const hash = await bcrypt.hash('pass123', 1);
repo.findByUsername.mockResolvedValueOnce({
  _id: 'u1',
  username: 'alice',
  isActive: true,
  password: hash,
  toObject: function() { return { _id: 'u1', username: 'alice', isActive: true }; }
});
    repo.updateLastLogin.mockResolvedValueOnce({});

    const user = await userService.verifyCredentials('alice', 'pass123');
    expect(user).toMatchObject({ _id: 'u1', username: 'alice' });
    expect(repo.updateLastLogin).toHaveBeenCalledWith('u1');
  });

  test('getUserById caches the result', async () => {
    cache.get.mockResolvedValueOnce(null);
    repo.findById.mockResolvedValueOnce({ _id: 'u2', username: 'bob' });

    const u = await userService.getUserById('u2');
    expect(u.username).toBe('bob');
    expect(cache.set).toHaveBeenCalledWith('user:u2', { _id: 'u2', username: 'bob' }, 300);
  });
});