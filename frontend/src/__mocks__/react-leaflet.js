const container = document.createElement('div');
container.style.width = '800px';
container.style.height = '600px';
const listeners = {};
const fakeMap = {
  _loaded: true,
  getContainer: () => container,
  getSize: () => ({ x: 800, y: 600 }),
  createPane: jest.fn(),
  getPane: jest.fn(() => null),
  on: jest.fn((ev, cb) => { listeners[ev] = cb; }),
  off: jest.fn(),
  getBounds: () => ({
    getSouth: () => -1000,
    getNorth: () => 1000,
    getWest: () => -1000,
    getEast: () => 1000,
  }),
  latLngToContainerPoint: ({ lat, lng }) => ({ x: Math.round(lng + 400), y: Math.round(lat + 300) }),
};

module.exports = {
  __esModule: true,
  useMap: () => fakeMap,
  __container: container,
};