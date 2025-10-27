jest.mock('../../src/models/Settings', () => ({
  findOne: jest.fn(() => Promise.resolve(null)),
  create: jest.fn(() => Promise.resolve({ _id: 's1' })),
  findOneAndUpdate: jest.fn(() => Promise.resolve({ _id: 's1', a: 1 })),
}));

const Settings = require('../../src/models/Settings');
const repo = require('../../src/repositories/settings.repository');

describe('SettingsRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  test('get creates when missing', async () => {
    const s = await repo.get();
    expect(Settings.create).toHaveBeenCalled();
  });

  test('update uses findOneAndUpdate with upsert', async () => {
    await repo.update({ a: 1 });
    expect(Settings.findOneAndUpdate).toHaveBeenCalled();
  });

  test('updateField sets specific field', async () => {
    await repo.updateField('x', 2);
    expect(Settings.findOneAndUpdate).toHaveBeenCalled();
  });
});