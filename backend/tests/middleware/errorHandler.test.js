const request = require('supertest');
const express = require('express');
const { errorHandler, notFound, AppError } = require('../../src/middleware/errorHandler');

// Build a tiny app to exercise middleware
function buildApp(routeHandler) {
  const app = express();
  app.get('/ok', (req, res) => res.json({ ok: true }));
  app.get('/err', routeHandler);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  test('handles AppError with provided status', async () => {
    const app = buildApp(() => { throw new AppError('Boom', 418); });
    const res = await request(app).get('/err');
    expect(res.status).toBe(418);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Boom');
  });

  test('maps CastError to 404', async () => {
    const err = new Error('bad id');
    err.name = 'CastError';
    const app = buildApp(() => { throw err; });
    const res = await request(app).get('/err');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Resource not found');
  });

  test('maps duplicate key 11000 to 400 with field name', async () => {
    const err = new Error('dup');
    err.code = 11000;
    err.keyValue = { username: 'alice' };
    const app = buildApp(() => { throw err; });
    const res = await request(app).get('/err');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Duplicate field value: username');
  });

  test('maps ValidationError to 400 with messages', async () => {
    const err = new Error('validation');
    err.name = 'ValidationError';
    err.errors = { a: { message: 'A required' }, b: { message: 'B bad' } };
    const app = buildApp(() => { throw err; });
    const res = await request(app).get('/err');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('A required');
    expect(res.body.error).toContain('B bad');
  });

  test('maps JWT errors appropriately', async () => {
    const jwtErr = new Error('jwt');
    jwtErr.name = 'JsonWebTokenError';
    const app1 = buildApp(() => { throw jwtErr; });
    const r1 = await request(app1).get('/err');
    expect(r1.status).toBe(401);

    const expErr = new Error('expired');
    expErr.name = 'TokenExpiredError';
    const app2 = buildApp(() => { throw expErr; });
    const r2 = await request(app2).get('/err');
    expect(r2.status).toBe(401);
  });

  test('notFound converts unknown route to 404 AppError', async () => {
    const app = buildApp((req, res) => res.json({}));
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Route not found');
  });
});