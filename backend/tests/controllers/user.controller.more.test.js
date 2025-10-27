jest.mock('../../src/services/user.service', () => ({
  getUserById: jest.fn(() => Promise.resolve({ _id:'me' })),
  getCurrentUser: jest.fn(() => Promise.resolve({ _id:'me' })),
  getUsersByRole: jest.fn(() => Promise.resolve([{ _id:'u1' }])),
  updateUser: jest.fn(() => Promise.resolve({ _id:'me' })),
  getUserCount: jest.fn(() => Promise.resolve(5)),
  getUserStats: jest.fn(() => Promise.resolve({ total: 5 })),
  getAllUsers: jest.fn(() => Promise.resolve({ users:[], total:0, page:1, limit:20 })),
}));

const svc = require('../../src/services/user.service');
const controller = require('../../src/controllers/user.controller');

function res(){ return { statusCode:200, json: jest.fn(), status(c){ this.statusCode=c; return this; } }; }
const ctx = { user: { _id:'me', role:'analyst' } };

describe('UserController additional endpoints', () => {
  test('getCurrentUser', async () => {
    const r = res();
    await controller.getCurrentUser(ctx, r);
    expect(r.json).toHaveBeenCalledWith({ _id:'me' });
  });

  test('getUsersByRole', async () => {
    const r = res();
    await controller.getUsersByRole({ params:{ role:'analyst' } }, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('updateCurrentUser', async () => {
    const r = res();
    await controller.updateCurrentUser({ ...ctx, body:{ region:'x' } }, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('getUserCount', async () => {
    const r = res();
    await controller.getUserCount({}, r);
    expect(r.json).toHaveBeenCalledWith({ count: 5 });
  });

  test('getUserStats', async () => {
    const r = res();
    await controller.getUserStats({}, r);
    expect(r.json).toHaveBeenCalledWith({ total: 5 });
  });

  test('getTeamMembers', async () => {
    const r = res();
    await controller.getTeamMembers({}, r);
    expect(r.json).toHaveBeenCalled();
  });
});