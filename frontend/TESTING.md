# Frontend Testing Guide

This document explains how tests are organized, how to run them, how our mocks and environment stubs work, and how to write new tests that achieve high coverage with realistic behavior.

## Quick start

- Install dependencies: `npm install`
- Run all tests once (no watch): `npm run test`
- Run with coverage: `npm run test:coverage`
- Generate and view HTML report:
  - `npm run test:report`
  - Open `tests-report/report.html`

Jest is configured via CRACO (see `craco.config.js`). Babel is configured in `babel.config.js`.

## Project testing stack

- Test runner: Jest (via `craco test`)
- React testing: @testing-library/react
- Hooks testing: @testing-library/react (renderHook) and simple custom patterns
- Coverage: Jest (html, lcov, text, clover)
- HTML test report: `jest-html-reporters` to `tests-report/report.html`

## File layout and conventions

- Tests live next to their source files:
  - `src/components/Foo.jsx` => `src/components/Foo.test.jsx`
  - `src/utils/bar.js` => `src/utils/bar.test.js`
- Manual Jest mocks in `src/__mocks__/`:
  - `axios.js` – Axios stub used by `jest.mock('axios')`
  - `react-router-dom.js` – Lightweight router stand-ins
  - `react-leaflet.js` – Fake map object + exposed container for overlays
- Global test setup: `src/setupTests.js`
  - Adds `@testing-library/jest-dom`
  - Stubs browser APIs not present in JSDOM:
    - Web Worker, `URL.createObjectURL`
    - `window.matchMedia`
    - Canvas 2D context (`HTMLCanvasElement.prototype.getContext`)

## Commands

- `npm run test` – Run once (watch disabled)
- `npm run test:coverage` – Run and collect coverage (HTML, text, lcov)
- `npm run test:report` – Run and emit an HTML report to `tests-report/report.html`

Coverage collection is configured in `craco.config.js`:

- `collectCoverage: true`
- `collectCoverageFrom`: `src/**/*.{js,jsx}` (excluding mocks, wasm parser, workers)
- `coverageReporters`: `json`, `lcov`, `text`, `clover`, `html`

## Key patterns and mocks

### 1) Fetch vs Axios

- Utilities using `fetch` (e.g., `src/utils/api.js`): mock `global.fetch` in tests.
- Contexts/services using Axios: `jest.mock('axios')` uses the manual mock in `src/__mocks__/axios.js` or inline mocks per test.

Example (fetch):
```js path=null start=null
jest.spyOn(global, 'fetch').mockResolvedValue({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => ({ ok: true }),
  text: async () => '{}',
});
```

Example (axios):
```js path=null start=null
import axios from 'axios';
jest.mock('axios');
axios.get.mockResolvedValue({ data: [] });
axios.post.mockResolvedValue({ data: {} });
```

### 2) WebSocket service (socket.io)

`src/services/websocketService.js` creates a singleton. For unit testing its logic without real sockets:

- Prefer patching the instance to a “connected” state:
```js path=null start=null
const ws = require('./websocketService').default;
ws.socket = { connected: true, emit: jest.fn(), on: jest.fn(), disconnect: jest.fn() };
ws.connected = true;
ws.startHeartbeat();
jest.advanceTimersByTime(31000);
expect(ws.socket.emit).toHaveBeenCalledWith('ping');
ws.stopHeartbeat();
```
- When testing hooks that depend on it, use `jest.mock('../services/websocketService', () => ({ default: svc }))` and record callbacks via `svc.on.mock.calls`.

### 3) React-leaflet and Canvas overlays

- `react-leaflet` is manually mocked in `src/__mocks__/react-leaflet.js` to provide a fake map object and a known container element.
- `setupTests.js` stubs Canvas 2D APIs (`getContext`) to avoid JSDOM errors.
- For animations (requestAnimationFrame/interval), use `jest.useFakeTimers()` and `jest.advanceTimersByTime(...)`.

Testing Heatmap overlays:
```js path=null start=null
jest.useFakeTimers();
const { __container } = require('react-leaflet');
// render component ...
jest.advanceTimersByTime(50);
expect(__container.querySelector('canvas')).not.toBeNull();
```

### 4) Auth and routing

- `AuthContext` uses Axios and sessionStorage for token.
- Tests should clear/seed `sessionStorage` and mock Axios responses:
```js path=null start=null
sessionStorage.setItem('token', 't');
axios.get.mockResolvedValueOnce({ data: { user: { username: 'u' } } });
```
- For components using router hooks (e.g., `useNavigate`, `useLocation`), mock:
```js path=null start=null
jest.mock('react-router-dom', () => ({
  __esModule: true,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/dashboard' }),
  Link: ({ children }) => <a>{children}</a>,
}));
```

### 5) OTP workflows

`src/components/OTPInput.js` talks to OTP endpoints with `fetch`. Tests stub `global.fetch` and should use `act` for async updates.

```js path=null start=null
jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ verified: true }) });
// trigger input and paste events ...
```

### 6) Notifications & timers

`NotificationsBar` uses `window.dispatchEvent(new CustomEvent('notify', ...))` and `setTimeout` for auto-dismiss. Wrap dispatch and `advanceTimersByTime` in `act(...)` to avoid warnings.

## Writing new tests

1) Identify the unit type:
- Pure util ⇒ assert pure outputs and error paths
- Component ⇒ render with testing-library; simulate events; assert DOM
- Hook ⇒ `renderHook` with necessary provider wrappers
- Service ⇒ call methods directly; mock external IO

2) Decide mocking strategy:
- Prefer unit isolation: mock network/WS/leaflet layers
- Use manual mocks from `src/__mocks__` when available

3) Cover branches
- Check early-return paths, error handlers, and conditional rendering
- For components, render under different props/roles/states

4) Timers/async
- `jest.useFakeTimers()` for components/services with intervals/timeouts
- Always wrap stateful async updates in `await act(async () => {...})`

## Common issues and fixes

- Babel import-meta error:
  - We conditionally disable `babel-plugin-transform-import-meta` in `babel.config.js` for the `test` env.
- Missing Canvas APIs in JSDOM:
  - `setupTests.js` implements `HTMLCanvasElement.prototype.getContext`.
- `window.matchMedia` undefined:
  - Stub provided in `setupTests.js`.
- Jest complaining about act:
  - Wrap event dispatches and timer advances in `act(...)`.
- Leaflet CSS assets in Jest:
  - CSS is mapped to `identity-obj-proxy` via `craco.config.js`'s `moduleNameMapper`.

## Increasing coverage quickly

- Add “smoke” tests that render components with minimal props and assert key text/roles.
- Test conditional branches by toggling props (e.g., `showDetails`, `connected`, `error`).
- For large pages (in `src/pages/`), a single render plus a couple of interactions vastly increases line coverage.
- If needed, you can exclude very UI-heavy folders from coverage via `craco.config.js` (`collectCoverageFrom` entries). Prefer testing them instead.

## Debugging tests

- Run a single test file: `npx jest path/to/file.test.jsx --runInBand`
- Watch mode for a specific file: `npx jest path/to/file.test.jsx --watch`
- Print logs: use `screen.debug()` or `console.log` during development

## CI notes

- The HTML report is written to `tests-report/report.html`.
- Coverage thresholds are not enforced by default; add `coverageThreshold` to Jest config if required.

## Example recipes

Component test:
```js path=null start=null
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders and interacts', () => {
  render(<MyComponent label="Hello" />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(/clicked/i)).toBeInTheDocument();
});
```

Hook test with provider:
```js path=null start=null
import { renderHook, act } from '@testing-library/react';
import { MyProvider } from '../contexts/MyContext';
import useThing from './useThing';

const wrapper = ({ children }) => <MyProvider>{children}</MyProvider>;

test('updates state', () => {
  const { result } = renderHook(() => useThing(), { wrapper });
  act(() => result.current.doUpdate());
  expect(result.current.value).toBe(1);
});
```

Service test (no IO):
```js path=null start=null
import svc from './myService';

test('pure method', () => {
  expect(svc.add(2, 3)).toBe(5);
});
```

If you have questions or want help targeting a specific component/module for higher coverage, add a test request and we’ll draft an example quickly.
