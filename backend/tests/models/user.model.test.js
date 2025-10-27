const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');

describe('User model', () => {
  test('validate required fields', () => {
    const u = new User({});
    const err = u.validateSync();
    expect(err).toBeTruthy();
    expect(err.errors).toHaveProperty('username');
    expect(err.errors).toHaveProperty('email');
    expect(err.errors).toHaveProperty('password');
    expect(err.errors).toHaveProperty('firstName');
    expect(err.errors).toHaveProperty('lastName');
  });

  test('toJSON removes password', () => {
    const u = new User({ username:'a', email:'a@x.com', password:'secret', firstName:'f', lastName:'l' });
    const json = u.toJSON();
    expect(json.password).toBeUndefined();
  });

  test('instance methods work', async () => {
    const hash = await bcrypt.hash('pw', 1);
    const u = new User({ username:'a', email:'a@x.com', password: hash, firstName:'f', lastName:'l' });
    expect(await u.comparePassword('pw')).toBe(true);
    expect(u.getFullName()).toBe('f l');
    expect(u.changedPasswordAfter(Math.floor(Date.now()/1000) - 10)).toBe(false);
  });
});