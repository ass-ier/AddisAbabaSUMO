jest.mock('../../src/services/settings.service', () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
}));

const svc = require('../../src/services/settings.service');
const controller = require('../../src/controllers/settings.controller');

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c){ this.statusCode = c; return this; },
    json(b){ this.body = b; return this; },
  };
}

describe('SettingsController', () => {
  test('getSettings success', async () => {
    svc.getSettings.mockResolvedValueOnce({ a: 1 });
    const res = mockRes();
    await controller.getSettings({}, res);
    expect(res.body).toEqual({ a: 1 });
  });

  test('getSettings error path', async () => {
    svc.getSettings.mockRejectedValueOnce(new Error('x'));
    const res = mockRes();
    await controller.getSettings({}, res);
    expect(res.statusCode).toBe(500);
  });

  test('updateSettings success', async () => {
    svc.updateSettings.mockResolvedValueOnce({ a: 2 });
    const res = mockRes();
    await controller.updateSettings({ body: { a: 2 } }, res);
    expect(res.body).toEqual({ a: 2 });
  });
});