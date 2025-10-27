const models = [
  '../../src/models/AuditLog',
  '../../src/models/Emergency',
  '../../src/models/OTP',
  '../../src/models/Settings',
  '../../src/models/SimulationStatus',
  '../../src/models/SumoLog',
  '../../src/models/TrafficData',
  '../../src/models/User',
];

describe('Model modules load', () => {
  test.each(models)('%s loads', (m) => {
    const mod = require(m);
    expect(mod).toBeTruthy();
  });
});