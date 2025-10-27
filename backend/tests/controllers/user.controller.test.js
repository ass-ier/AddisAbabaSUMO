jest.mock('../../src/services/user.service', () => ({
  getAllUsers: jest.fn(),
  getUserById: jest.fn(),
  getUserByUsername: jest.fn(),
  getUsersByRole: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  getUserCount: jest.fn(),
  getUserStats: jest.fn(),
}));

const svc = require('../../src/services/user.service');
const controller = require('../../src/controllers/user.controller');

function res(){ return { statusCode:200, json: jest.fn(), status(c){ this.statusCode=c; return this; } }; }

const currentUser = { user: { _id: 'me', role:'super_admin' } };

describe('UserController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getAllUsers returns paginated data', async () => {
    svc.getAllUsers.mockResolvedValueOnce({ users:[{_id:'u1'}], total:1, page:1, limit:20 });
    const r = res();
    await controller.getAllUsers({ query: {} }, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('getUserById returns data', async () => {
    svc.getUserById.mockResolvedValueOnce({ _id:'u1' });
    const r = res();
    await controller.getUserById({ params:{ id:'u1' } }, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('createUser returns 201', async () => {
    svc.createUser.mockResolvedValueOnce({ _id:'u2' });
    const r = res();
    await controller.createUser({ body:{ username:'a', password:'b', role:'analyst', email:'e@x.com', firstName:'f', lastName:'l' } }, r);
    expect(r.statusCode).toBe(201);
  });

  test('updateUser returns ok', async () => {
    svc.updateUser.mockResolvedValueOnce({ _id:'u1' });
    const r = res();
    await controller.updateUser({ params:{ id:'u1' }, body:{ role:'analyst' }, ...currentUser }, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('deleteUser returns ok', async () => {
    svc.deleteUser.mockResolvedValueOnce({ ok:true });
    const r = res();
    await controller.deleteUser({ params:{ id:'u1' }, ...currentUser }, r);
    expect(r.json).toHaveBeenCalled();
  });
});