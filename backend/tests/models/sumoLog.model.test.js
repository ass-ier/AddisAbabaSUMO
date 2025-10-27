const SumoLog = require('../../src/models/SumoLog');

describe('SumoLog model', () => {
  test('isImportant flags conditions', () => {
    const warnSim = new SumoLog({ timestamp:new Date(), message:'m', type:'warning', username:'u', userRole:'user', category:'simulation_control' });
    expect(warnSim.isImportant()).toBe(true);
    const info = new SumoLog({ timestamp:new Date(), message:'m', type:'info', username:'u', userRole:'user', category:'other' });
    expect(info.isImportant()).toBe(false);
  });
});