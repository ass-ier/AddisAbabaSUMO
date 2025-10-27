const AuditLog = require('../../src/models/AuditLog');

describe('AuditLog model', () => {
  test('pre-save sets riskLevel and sensitive', async () => {
    const a = new AuditLog({ user:'u', role:'user', action:'password reset', category:'authentication', outcome:'failure' });
    // Manually trigger pre-save hooks
    const pres = a.constructor.schema.stack.filter(s => s.kind === 'pre' && s.hook === 'save');
    for (const p of pres) {
      await new Promise((resolve) => p.fn.call(a, resolve));
    }
    expect(['medium','high','low','critical']).toContain(a.riskLevel);
    expect(a.sensitive).toBe(true);
  });
});