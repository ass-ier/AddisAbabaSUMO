const OTP = require('../../src/models/OTP');

describe('OTP model', () => {
  test('defaults and enums', () => {
    const o = new OTP({ identifier:'e@x.com', identifierType:'email', otp:'123456', purpose:'registration', expiresAt:new Date(Date.now()+60000) });
    const err = o.validateSync();
    expect(err).toBeUndefined();
    expect(o.attempts).toBe(0);
    expect(o.maxAttempts).toBe(3);
  });
});