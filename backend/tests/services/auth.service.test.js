const authService = require('../../src/services/auth.service');

jest.mock('../../src/services/user.service', () => ({
  verifyCredentials: jest.fn(),
  createUser: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  generateToken: jest.fn().mockReturnValue('token-123'),
}));

const userService = require('../../src/services/user.service');
const { generateToken } = require('../../src/middleware/auth');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('login returns user and token', async () => {
    const mockUser = { _id: 'u1', username: 'alice', role: 'analyst' };
    userService.verifyCredentials.mockResolvedValueOnce(mockUser);

    const res = await authService.login('alice', 'pass');

    expect(userService.verifyCredentials).toHaveBeenCalledWith('alice', 'pass');
    expect(generateToken).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ user: mockUser, token: 'token-123' });
  });

  test('register sets default role and returns user and token', async () => {
    const input = { username: 'bob', password: 'secret' };
    const created = { _id: 'u2', username: 'bob', role: 'analyst' };
    userService.createUser.mockResolvedValueOnce(created);

    const res = await authService.register(input);

    expect(userService.createUser).toHaveBeenCalledWith({ ...input, role: 'analyst' });
    expect(generateToken).toHaveBeenCalledWith('u2');
    expect(res).toEqual({ user: created, token: 'token-123' });
  });

  test('verifyToken returns decoded payload for valid token', async () => {
    const jwt = require('jsonwebtoken');
    const spy = jest.spyOn(jwt, 'verify').mockReturnValueOnce({ id: 'u1' });

    const decoded = await authService.verifyToken('abc');

    expect(spy).toHaveBeenCalled();
    expect(decoded).toEqual({ id: 'u1' });
  });
});