jest.mock('../../src/repositories/user.repository', () => ({
  findById: jest.fn(),
  findByUsername: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  updateLastLogin: jest.fn(),
  exists: jest.fn(),
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
const { AppError } = require('../../src/middleware/errorHandler');

describe('UserService extra branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createUser rejects short password', async () => {
    repo.findByUsername.mockResolvedValueOnce(null);
    await expect(userService.createUser({ username: 'a', password: '123' })).rejects.toThrow('Password must be at least 6');
  });

  test('verifyCredentials rejects wrong password', async () => {
    const hash = await bcrypt.hash('pass123', 1);
    repo.findByUsername.mockResolvedValueOnce({ _id: 'u1', username: 'alice', isActive: true, password: hash });
    await expect(userService.verifyCredentials('alice', 'bad')).rejects.toThrow('Invalid credentials');
  });

  test('verifyCredentials rejects deactivated', async () => {
    const hash = await bcrypt.hash('pass123', 1);
    repo.findByUsername.mockResolvedValueOnce({ _id: 'u1', username: 'alice', isActive: false, password: hash });
    await expect(userService.verifyCredentials('alice', 'pass123')).rejects.toThrow('deactivated');
  });

  test('getUsersByRole invalid role', async () => {
    await expect(userService.getUsersByRole('badrole')).rejects.toThrow('Invalid role');
  });
});