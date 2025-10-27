jest.mock('../../src/services/emergency.service', () => ({
  createEmergency: jest.fn(),
  getActiveEmergencies: jest.fn(),
  forceClearEmergency: jest.fn(),
}));

const svc = require('../../src/services/emergency.service');
const controller = require('../../src/controllers/emergency.controller');

function res() {
  return { statusCode: 200, body: undefined, status(c){ this.statusCode=c; return this; }, json(b){ this.body=b; return this; } };
}

describe('EmergencyController', () => {
  test('createEmergency success', async () => {
    svc.createEmergency.mockResolvedValueOnce({ _id: 'e1' });
    const r = res();
    await controller.createEmergency({ body: { v: 1 } }, r);
    expect(r.statusCode).toBe(201);
    expect(r.body.ok).toBe(true);
  });

  test('createEmergency error path', async () => {
    svc.createEmergency.mockRejectedValueOnce(new Error('x'));
    const r = res();
    await controller.createEmergency({ body: {} }, r);
    expect(r.statusCode).toBe(500);
  });

  test('getActiveEmergencies', async () => {
    svc.getActiveEmergencies.mockResolvedValueOnce({ items: [] });
    const r = res();
    await controller.getActiveEmergencies({}, r);
    expect(r.body.items).toEqual([]);
  });

  test('forceClearEmergency', async () => {
    svc.forceClearEmergency.mockResolvedValueOnce({ _id: 'e1', active: false });
    const r = res();
    await controller.forceClearEmergency({ params: { id: 'e1' } }, r);
    expect(r.body.ok).toBe(true);
  });
});