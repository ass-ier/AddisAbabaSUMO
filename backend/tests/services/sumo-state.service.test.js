const svc = require('../../src/services/sumo-state.service');

describe('SumoStateService', () => {
  test('set/get snapshot', () => {
    svc.setLatestVehiclesSnapshot({ timestamp: 123, vehicles: [{ id:1 }] });
    const s = svc.getLatestVehiclesSnapshot();
    expect(s.timestamp).toBe(123);
    expect(s.vehicles.length).toBe(1);
  });
});