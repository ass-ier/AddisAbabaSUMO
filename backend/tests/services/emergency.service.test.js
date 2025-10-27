jest.mock('../../src/repositories/emergency.repository', () => ({
  create: jest.fn(),
  findActive: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
  delete: jest.fn(),
  countActive: jest.fn(),
}));

jest.mock('../../src/services/cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
}));

const repo = require('../../src/repositories/emergency.repository');
const cache = require('../../src/services/cache.service');
const service = require('../../src/services/emergency.service');

describe('EmergencyService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createEmergency invalidates cache', async () => {
    repo.create.mockResolvedValueOnce({ _id: 'e1' });
    const r = await service.createEmergency({ vehicleId: 'v1' });
    expect(cache.delete).toHaveBeenCalledWith('active_emergencies');
    expect(r._id).toBe('e1');
  });

  test('getActiveEmergencies returns from cache', async () => {
    cache.get.mockResolvedValueOnce({ items: [1] });
    const r = await service.getActiveEmergencies();
    expect(r.items).toEqual([1]);
    expect(repo.findActive).not.toHaveBeenCalled();
  });

  test('getActiveEmergencies queries and caches when miss', async () => {
    cache.get.mockResolvedValueOnce(null);
    repo.findActive.mockResolvedValueOnce([1, 2]);
    const r = await service.getActiveEmergencies();
    expect(cache.set).toHaveBeenCalled();
    expect(r.items).toEqual([1, 2]);
  });

  test('forceClearEmergency deactivates and invalidates cache', async () => {
    repo.deactivate.mockResolvedValueOnce({ ok: true });
    const r = await service.forceClearEmergency('x');
    expect(cache.delete).toHaveBeenCalledWith('active_emergencies');
    expect(r).toEqual({ ok: true });
  });
});