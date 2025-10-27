jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockRejectedValue(new Error('smtp down')),
  })),
}));

const otpService = require('../../src/services/otp.service');

jest.mock('../../src/models/OTP', () => ({
  deleteMany: jest.fn(() => ({ acknowledged: true })),
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
}));

const OTP = require('../../src/models/OTP');

describe('OTP Service more cases', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createAndSendOTP falls back when email fails', async () => {
    OTP.deleteMany.mockResolvedValueOnce({});
    OTP.create.mockResolvedValueOnce({});
    const res = await otpService.createAndSendOTP('user@example.com', 'email', 'login');
    expect(res.success).toBe(true);
  });

  test('createAndSendOTP with SMS path', async () => {
    OTP.deleteMany.mockResolvedValueOnce({});
    OTP.create.mockResolvedValueOnce({});
    const res = await otpService.createAndSendOTP('+15550001111', 'phone', 'login');
    expect(res.success).toBe(true);
  });

  test('verifyOTP expired throws', async () => {
    const record = {
      _id: 'x', otp: '111111', verified: false, expiresAt: new Date(Date.now() - 1000), attempts: 0, maxAttempts: 3, save: jest.fn()
    };
    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(record) });
    await expect(otpService.verifyOTP('e@x.com', '111111', 'login')).rejects.toThrow('expired');
  });

  test('verifyOTP exceeds max attempts deletes and throws', async () => {
    const record = {
      _id: 'x', otp: '111111', verified: false, expiresAt: new Date(Date.now() + 60000), attempts: 2, maxAttempts: 2, save: jest.fn()
    };
    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(record) });
    await expect(otpService.verifyOTP('e@x.com', '000000', 'login')).rejects.toThrow('Maximum verification attempts exceeded');
    expect(OTP.deleteOne).toHaveBeenCalled();
  });
});