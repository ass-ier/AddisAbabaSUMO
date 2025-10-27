const { validate, schemas } = require('../../src/middleware/validation');

function run(schema, data, property = 'body') {
  const req = { [property]: data };
  const res = {};
  return new Promise((resolve, reject) => {
    validate(schema, property)(req, res, (err) => (err ? reject(err) : resolve('ok')));
  });
}

describe('validation middleware', () => {
  test('passes when data is valid', async () => {
    await expect(run(schemas.login, { username: 'a', password: 'b' })).resolves.toBe('ok');
  });

  test('fails with AppError when invalid', async () => {
    await expect(run(schemas.login, { username: '' })).rejects.toThrow();
  });

  test('query pagination defaults applied', async () => {
    const req = { query: {} };
    const res = {};
    let nextErr;
    validate(schemas.paginationQuery, 'query')(req, res, (err) => (nextErr = err));
    expect(nextErr).toBeUndefined();
    expect(req.query.page ?? 1).toBe(1);
    expect(req.query.limit ?? 20).toBe(20);
  });
});