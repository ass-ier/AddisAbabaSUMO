const Emergency = require('../../src/models/Emergency');

describe('Emergency model', () => {
  test('generates emergencyId on save pre-hook', async () => {
    const e = new Emergency({
      emergencyId: undefined,
      type: 'accident',
      title: 'Crash',
      description: 'Minor crash',
      reportedBy: '000000000000000000000001'
    });
    // We cannot actually save without DB; simulate pre-save hook by calling validateSync and checking id fallback logic using getters
    expect(e.emergencyId).toBeUndefined();
    // Simulate save hook execution
    e.constructor.schema._middlewareFns = e.constructor.schema._middlewareFns || [];
    // Call our pre-save hooks manually
    const pres = e.constructor.schema.stack.filter(s => s.kind === 'pre' && s.hook === 'save');
    for (const p of pres) {
      await new Promise((resolve) => p.fn.call(e, resolve));
    }
    expect(e.emergencyId).toMatch(/^EMG-/);
  });

  test('getDuration and isOverdue work', () => {
    const now = new Date();
    const start = new Date(now.getTime() - 10 * 60 * 1000); // 10 min ago
    const e = new Emergency({
      emergencyId: 'X', type:'accident', title:'t', description:'d', reportedBy: '000000000000000000000001',
      startTime: start, estimatedDuration: 5, active: true
    });
    const dur = e.getDuration();
    expect(dur).toBeGreaterThanOrEqual(9);
    expect(e.isOverdue()).toBe(true);
  });

  test('addNote pushes and returns promise-like', async () => {
    const e = new Emergency({ emergencyId:'E', type:'accident', title:'t', description:'d', reportedBy:'000000000000000000000001' });
    // mock save
    e.save = jest.fn(() => Promise.resolve(e));
    const res = await e.addNote('hello', '000000000000000000000001');
    expect(e.notes.length).toBe(1);
    expect(res).toBe(e);
  });
});