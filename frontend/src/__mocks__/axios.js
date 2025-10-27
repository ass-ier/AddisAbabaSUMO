// Manual Jest mock for axios (ESM in node_modules)
const axiosMock = {
  get: jest.fn(async () => ({ data: {} })),
  post: jest.fn(async () => ({ data: {} })),
  put: jest.fn(async () => ({ data: {} })),
  delete: jest.fn(async () => ({ data: {} })),
  interceptors: { response: { use: jest.fn(() => 1), eject: jest.fn() } },
  defaults: { headers: { common: {} }, baseURL: '', withCredentials: false },
  create: jest.fn(() => axiosMock),
};

module.exports = axiosMock;
