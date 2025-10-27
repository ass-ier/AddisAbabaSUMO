const jwt = require('jsonwebtoken');

jest.mock('../../src/repositories/user.repository', () => ({
  findById: jest.fn(),
}));

const userRepo = require('../../src/repositories/user.repository');
const auth = require('../../src/middleware/auth');
const { AppError } = require('../../src/middleware/errorHandler');

function makeReq({ bearer, cookieToken } = {}) {
  return {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    cookies: cookieToken ? { token: cookieToken } : {},
    originalUrl: '/x',
  };
}

function makeRes() { return {}; }

function call(mw, req) {
  return new Promise((resolve, reject) => mw(req, makeRes(), (err) => err ? reject(err) : resolve('next')));
}

describe('auth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_TOKEN_SECRET = 'test-secret';
  });

  test('authenticateToken works with Bearer token', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({ id: 'u1' });
    userRepo.findById.mockResolvedValueOnce({ _id: 'u1', username: 'a', role: 'analyst', isActive: true });
    const req = makeReq({ bearer: 't' });
    const res = await call(auth.authenticateToken, req);
    expect(res).toBe('next');
    expect(req).toHaveProperty('user');
  });

  test('authenticateToken errors when no token', async () => {
    const req = makeReq();
    await expect(call(auth.authenticateToken, req)).rejects.toThrow('No token');
  });

  test('invalid token maps to 401 Invalid token', async () => {
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => { const e = new Error('bad'); e.name = 'JsonWebTokenError'; throw e; });
    const req = makeReq({ bearer: 't' });
    await expect(call(auth.authenticateToken, req)).rejects.toThrow('Invalid token');
  });

  test('expired token maps to 401 Token expired', async () => {
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => { const e = new Error('exp'); e.name = 'TokenExpiredError'; throw e; });
    const req = makeReq({ bearer: 't' });
    await expect(call(auth.authenticateToken, req)).rejects.toThrow('Token expired');
  });

  test('user not found', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({ id: 'u1' });
    userRepo.findById.mockResolvedValueOnce(null);
    const req = makeReq({ bearer: 't' });
    await expect(call(auth.authenticateToken, req)).rejects.toThrow('User no longer exists');
  });

  test('user deactivated', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({ id: 'u1' });
    userRepo.findById.mockResolvedValueOnce({ _id: 'u1', isActive: false });
    const req = makeReq({ bearer: 't' });
    await expect(call(auth.authenticateToken, req)).rejects.toThrow('deactivated');
  });

  test('optionalAuth attaches user when valid, ignores errors', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({ id: 'u1' });
    userRepo.findById.mockResolvedValueOnce({ _id: 'u1', username: 'a', role: 'analyst', isActive: true });
    const req = makeReq({ bearer: 't' });
    await call(auth.optionalAuth, req);
    expect(req.user).toBeTruthy();

    // Now invalid token
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => { throw new Error('bad'); });
    const req2 = makeReq({ bearer: 't' });
    await call(auth.optionalAuth, req2);
    expect(req2.user).toBeUndefined();
  });

  test('requireRole denies and allows correctly', async () => {
    const mw = auth.requireRole('super_admin');
    const allowReq = { user: { role: 'super_admin', username: 'a' }, originalUrl: '/z' };
    const denyReq = { user: { role: 'analyst', username: 'a' }, originalUrl: '/z' };
    await expect(call(mw, allowReq)).resolves.toBe('next');
    await expect(call(mw, denyReq)).rejects.toThrow('Access denied');
  });

  test('requireAnyRole checks list', async () => {
    const mw = auth.requireAnyRole(['operator','analyst']);
    const ok = { user: { role: 'operator', username: 'x' }, originalUrl: '/z' };
    const bad = { user: { role: 'guest', username: 'x' }, originalUrl: '/z' };
    await expect(call(mw, ok)).resolves.toBe('next');
    await expect(call(mw, bad)).rejects.toThrow('Access denied');
  });

  test('requireOwnerOrAdmin allows owner or super_admin', async () => {
    const mw = auth.requireOwnerOrAdmin('u1');
    await expect(call(mw, { user: { _id: 'u1', username: 'a', role: 'analyst' }, originalUrl: '/r' })).resolves.toBe('next');
    await expect(call(mw, { user: { _id: 'u2', username: 'a', role: 'super_admin' }, originalUrl: '/r' })).resolves.toBe('next');
    await expect(call(mw, { user: { _id: 'u2', username: 'a', role: 'analyst' }, originalUrl: '/r' })).rejects.toThrow('Access denied');
  });

  test('operator/admin/superAdmin role middlewares enforce roles', async () => {
    await expect(call(auth.requireOperatorRole, { user: { role: 'operator', username: 'a' }, originalUrl: '/o' })).resolves.toBe('next');
    await expect(call(auth.requireOperatorRole, { user: { role: 'analyst', username: 'a' }, originalUrl: '/o' })).rejects.toThrow('operator');

    await expect(call(auth.requireAdminRole, { user: { role: 'super_admin', username: 'a' }, originalUrl: '/a' })).resolves.toBe('next');
    await expect(call(auth.requireAdminRole, { user: { role: 'operator', username: 'a' }, originalUrl: '/a' })).rejects.toThrow('Administrative');

    await expect(call(auth.requireSuperAdminRole, { user: { role: 'super_admin', username: 'a' }, originalUrl: '/s' })).resolves.toBe('next');
    await expect(call(auth.requireSuperAdminRole, { user: { role: 'admin', username: 'a' }, originalUrl: '/s' })).rejects.toThrow('Super administrator');
  });
});