// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Stub Worker and URL for tests that touch worker-based utils
class MockWorker {
  constructor() {}
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Worker = window.Worker || MockWorker;
  // @ts-ignore
  window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:mock');
}

// matchMedia stub for tests
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  };
}

// Canvas API stubs for jsdom
if (typeof HTMLCanvasElement !== 'undefined') {
  // eslint-disable-next-line no-undef
  HTMLCanvasElement.prototype.getContext = function () {
    const data = new Uint8ClampedArray(800 * 600 * 4);
    return {
      // drawing state
      fillStyle: '',
      strokeStyle: '',
      globalCompositeOperation: 'source-over',
      font: '12px sans-serif',
      canvas: { width: 800, height: 600 },
      // methods used in code
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      createImageData: jest.fn((w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
      getImageData: jest.fn(() => ({ data, width: 800, height: 600 })),
      putImageData: jest.fn(),
      createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      fillText: jest.fn(),
    };
  };
}
