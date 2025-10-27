const SimulationStatus = require('../../src/models/SimulationStatus');

describe('SimulationStatus model', () => {
  test('basic validation', () => {
    const ss = new SimulationStatus({ simulationId:'sim1', name:'Test', configuration:{ networkFile:'n.net.xml', totalSteps: 10 } });
    const err = ss.validateSync();
    expect(err).toBeUndefined();
    expect(ss.status).toBe('stopped');
  });
});