const express = require('express');
const request = require('supertest');

// Mock auth middlewares to pass and inject a user
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => { req.user = { _id: 'u1', username: 'alice', role: 'super_admin' }; next(); },
  requireRole: () => (req, res, next) => next(),
  requireAnyRole: () => (req, res, next) => next(),
}));

jest.mock('../../src/services/settings.service', () => ({
  getSettings: jest.fn(() => Promise.resolve({ a: 1 })),
  updateSettings: jest.fn(() => Promise.resolve({ a: 2 })),
}));

jest.mock('../../src/services/emergency.service', () => ({
  getActiveEmergencies: jest.fn(() => Promise.resolve({ items: [] })),
  createEmergency: jest.fn(() => Promise.resolve({ _id: 'e1' })),
  forceClearEmergency: jest.fn(() => Promise.resolve({ _id: 'e1', active: false })),
}));

jest.mock('../../src/services/stats.service', () => ({
  getKPIs: jest.fn(() => Promise.resolve({ uptime: 100 })),
  getTrends: jest.fn(() => Promise.resolve({ daily: [] })),
  getOverview: jest.fn(() => Promise.resolve({ systemHealth: 80 })),
  getAdminStats: jest.fn(() => Promise.resolve({ userCount: 5 })),
}));

const settingsRouter = require('../../src/routes/settings.routes');
const emergencyRouter = require('../../src/routes/emergency.routes');
const statsRouter = require('../../src/routes/stats.routes');

describe('Protected Routes', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    app.use('/api/emergencies', emergencyRouter);
    app.use('/api', statsRouter);
  });

  test('GET /api/settings returns settings', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ a: 1 });
  });

  test('PUT /api/settings updates settings', async () => {
    const res = await request(app).put('/api/settings').send({ a: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ a: 2 });
  });

  test('GET /api/emergencies returns active list', async () => {
    const res = await request(app).get('/api/emergencies');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  test('POST /api/emergencies creates new emergency', async () => {
    const res = await request(app).post('/api/emergencies').send({ vehicleId: 'v1' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  test('GET /api/reports/kpis returns KPIs', async () => {
    const res = await request(app).get('/api/reports/kpis');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uptime');
  });

  test('GET /api/stats/overview returns overview', async () => {
    const res = await request(app).get('/api/stats/overview');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('systemHealth');
  });
});