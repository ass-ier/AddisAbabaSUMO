const Settings = require('../../src/models/Settings');

describe('Settings model', () => {
  test('defaults are set and validate ranges', () => {
    const s = new Settings({});
    const err = s.validateSync();
    expect(err).toBeUndefined();
    expect(s.sumo.stepLength).toBeGreaterThan(0);
    expect(s.trafficLights.defaultCycleTime).toBeGreaterThan(0);
  });
});