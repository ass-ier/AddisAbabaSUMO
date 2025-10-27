const TrafficData = require('../../src/models/TrafficData');

describe('TrafficData model', () => {
  test('instance methods compute values', () => {
    const d = new TrafficData({ simulationTime: 1, intersectionId: 'I', vehicleCount: 10, averageSpeed: 15, occupancy: 85 });
    expect(['severe','heavy','moderate','light','free_flow']).toContain(d.getCongestionLevel());
    const score = d.getEfficiencyScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});