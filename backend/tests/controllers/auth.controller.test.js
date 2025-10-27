jest.mock('../../src/services/auth.service', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('../../src/services/otp.service', () => ({
  isVerified: jest.fn(),
  cleanupVerifiedOTP: jest.fn(),
}));

const authService = require('../../src/services/auth.service');
const otpService = require('../../src/services/otp.service');
const controller = require('../../src/controllers/auth.controller');

function mockRes(){
  return { cookies: {}, cookie(k,v){ this.cookies[k]=v; return this; }, clearCookie: jest.fn(), json: jest.fn().mockReturnThis(), status: jest.fn(function(c){ this.statusCode=c; return this; }) };
}

describe('AuthController', () => {
  beforeEach(() => jest.clearAllMocks());

  test('login sets cookie and returns token+user', async () => {
    authService.login.mockResolvedValueOnce({ token: 't', user: { _id: 'u1' } });
    const res = mockRes();
    await controller.login({ body: { username: 'a', password: 'b' } }, res);
    expect(res.cookies.token).toBe('t');
    expect(res.json).toHaveBeenCalledWith({ token: 't', user: { _id: 'u1' } });
  });

  test('register requires OTP verification', async () => {
    otpService.isVerified.mockResolvedValueOnce(true);
    authService.register.mockResolvedValueOnce({ token: 't', user: { _id: 'u2' } });
    const res = mockRes();
    await controller.register({ body: { username:'a', password:'b', firstName:'f', lastName:'l', email:'e@x.com', identifier: 'e@x.com', otpVerified: true } }, res);
    expect(otpService.cleanupVerifiedOTP).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });
});