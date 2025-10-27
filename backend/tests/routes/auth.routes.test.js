const express = require('express');
const request = require('supertest');

jest.mock('../../src/services/auth.service', () => ({
  login: jest.fn(() => Promise.resolve({ user: { _id: 'u1', username: 'alice' }, token: 't' })),
}));

const authRouter = require('../../src/routes/auth.routes');
const { validate, schemas } = require('../../src/middleware/validation');

describe('Auth Routes', () => {
  test('POST /api/auth/login returns token and user', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/login').send({ username: 'a', password: 'b' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
  });
});