// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  http: jest.fn(),
  debug: jest.fn(),
}));

// Default envs for tests
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';