jest.mock('../../src/repositories/user.repository', () => ({
  getRoleStatistics: jest.fn(() => Promise.resolve({ total:3, super_admin:1, admin:1, system_operator:1 })),
  count: jest.fn(() => Promise.resolve(3)),
  findOperators: jest.fn(() => Promise.resolve([{ _id:'o1' }])),
  findAdmins: jest.fn(() => Promise.resolve([{ _id:'a1' }])),
  findPrivilegedUsers: jest.fn(() => Promise.resolve([{ _id:'u1', role:'super_admin' },{ _id:'u2', role:'admin' },{ _id:'u3', role:'system_operator' }])) ,
  updateRole: jest.fn(() => Promise.resolve({ _id:'uX', role:'system_operator' })),
  softDelete: jest.fn(() => Promise.resolve({ _id:'uX', isActive:false })),
  findById: jest.fn(() => Promise.resolve({ _id:'uX', role:'system_operator', isActive:true, username:'bob' })),
  update: jest.fn(() => Promise.resolve({ _id:'uX', isActive:true })),
  findByUsername: jest.fn(() => Promise.resolve(null)),
  create: jest.fn(() => Promise.resolve({ _id:'new', role:'system_operator' })),
}));

jest.mock('../../src/services/audit.service', () => ({
  create: jest.fn(),
  getAuditLogs: jest.fn(),
  exportToCSV: jest.fn(),
  logAction: jest.fn(),
}));

const controller = require('../../src/controllers/user-management.controller');
const repo = require('../../src/repositories/user.repository');

function res(){ return { statusCode:200, json: jest.fn(), status(c){ this.statusCode=c; return this; } }; }
const reqBase = { user: { _id:'me', role:'super_admin', username:'me' }, params:{}, query:{}, body:{} };

describe('UserManagementController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('statistics returns counts', async () => {
    const r = res();
    await controller.getUserStatistics(reqBase, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('operators lists users', async () => {
    const r = res();
    await controller.getOperators({ ...reqBase, query:{ includeInactive:'false' } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  test('privileged groups by role', async () => {
    const r = res();
    await controller.getPrivilegedUsers(reqBase, r);
    expect(r.json).toHaveBeenCalled();
  });

  test('update role path', async () => {
    const r = res();
    await controller.updateUserRole({ ...reqBase, params:{ userId:'uX' }, body:{ role:'system_operator' } }, r);
    expect(repo.updateRole).toHaveBeenCalled();
  });

  test('deactivate user path', async () => {
    const r = res();
    await controller.deactivateUser({ ...reqBase, params:{ userId:'uX' } }, r);
    expect(repo.softDelete).toHaveBeenCalled();
  });

  test('activate user path', async () => {
    const r = res();
    await controller.activateUser({ ...reqBase, params:{ userId:'uX' } }, r);
    expect(repo.update).toHaveBeenCalled();
  });

  test('create operator path', async () => {
    const r = res();
    await controller.createOperator({ ...reqBase, body:{ username:'newop', password:'secret', firstName:'f', lastName:'l', email:'e@x.com' } }, r);
    expect(r.json).toHaveBeenCalled();
  });
});