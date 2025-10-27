jest.mock('../../src/repositories/settings.repository', () => ({
  get: jest.fn(),
  update: jest.fn(),
  updateField: jest.fn(),
}));

jest.mock('../../src/services/cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(), // service uses delete()
}));

const settingsRepo = require('../../src/repositories/settings.repository');
const cache = require('../../src/services/cache.service');
const settingsService = require('../../src/services/settings.service');

describe('SettingsService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getSettings returns from cache if present', async () => {
    cache.get.mockResolvedValueOnce({ a: 1 });
    const s = await settingsService.getSettings();
    expect(s).toEqual({ a: 1 });
    expect(settingsRepo.get).not.toHaveBeenCalled();
  });

  test('getSettings fetches and caches when missing', async () => {
    cache.get.mockResolvedValueOnce(null);
    settingsRepo.get.mockResolvedValueOnce({ a: 2 });
    const s = await settingsService.getSettings();
    expect(cache.set).toHaveBeenCalledWith('system_settings', { a: 2 });
    expect(s).toEqual({ a: 2 });
  });

  test('updateSettings updates and invalidates cache', async () => {
    settingsRepo.update.mockResolvedValueOnce({ ok: true });
    const r = await settingsService.updateSettings({ x: 1 });
    expect(cache.delete).toHaveBeenCalledWith('system_settings');
    expect(r).toEqual({ ok: true });
  });

  test('updateField updates and invalidates cache', async () => {
    settingsRepo.updateField.mockResolvedValueOnce({ y: 3 });
    const r = await settingsService.updateField('y', 3);
    expect(cache.delete).toHaveBeenCalledWith('system_settings');
    expect(r).toEqual({ y: 3 });
  });
});