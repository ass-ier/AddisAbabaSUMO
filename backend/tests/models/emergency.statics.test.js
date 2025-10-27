const Emergency = require('../../src/models/Emergency');

describe('Emergency statics', () => {
  test('findActive/findBySeverity/findByLocation return queries', () => {
    const q1 = Emergency.findActive();
    const q2 = Emergency.findBySeverity('high');
    const q3 = Emergency.findByLocation('I');
    expect(q1).toBeTruthy();
    expect(q2).toBeTruthy();
    expect(q3).toBeTruthy();
  });
});