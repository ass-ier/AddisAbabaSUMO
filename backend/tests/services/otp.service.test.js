jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'm1' }),
  })),
}));

const otpService = require('../../src/services/otp.service');
const OTP = require('../../src/models/OTP');

jest.mock('../../src/models/OTP', () => ({
  deleteMany: jest.fn(() => ({ acknowledged: true })),
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
}));

describe('OTP Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createAndSendOTP creates record and sends email', async () => {
    OTP.deleteMany.mockResolvedValueOnce({ acknowledged: true });
    OTP.create.mockResolvedValueOnce({ _id: 'otp1' });

    const res = await otpService.createAndSendOTP('user@example.com', 'email', 'login');

    expect(OTP.deleteMany).toHaveBeenCalled();
    expect(OTP.create).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.expiresIn).toBe(600);
  });

  test('verifyOTP rejects invalid code and increments attempts', async () => {
    const record = {
      _id: 'otp1',
      otp: '111111',
      verified: false,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      maxAttempts: 3,
      save: jest.fn(),
    };
OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(record) });

    await expect(otpService.verifyOTP('user@example.com', '000000', 'login')).rejects.toThrow('Invalid OTP');
    expect(record.save).toHaveBeenCalled();
  });

  test('verifyOTP resolves true for correct code', async () => {
    const record = {
      _id: 'otp2',
      otp: '123456',
      verified: false,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      maxAttempts: 3,
      save: jest.fn(),
    };
OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(record) });

    await expect(otpService.verifyOTP('user@example.com', '123456', 'login')).resolves.toBe(true);
    expect(record.verified).toBe(true);
    expect(record.save).toHaveBeenCalled();
  });
});