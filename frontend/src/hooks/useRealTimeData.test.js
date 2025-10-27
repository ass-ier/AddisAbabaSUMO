// Mock websocketService must be declared before importing hook under test
jest.mock("../services/websocketService", () => {
  const listeners = new Map();
  const svc = {
    isConnected: jest.fn(() => false),
    connect: jest.fn(async () => {}),
    authenticate: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn((ev, cb) => {
      const arr = listeners.get(ev) || [];
      arr.push(cb);
      listeners.set(ev, arr);
    }),
    off: jest.fn((ev, cb) => {
      const arr = listeners.get(ev) || [];
      const idx = arr.indexOf(cb);
      if (idx > -1) arr.splice(idx, 1);
      listeners.set(ev, arr);
    }),
    getSubscriptions: jest.fn(() => []),
    getConnectionInfo: jest.fn(() => ({ connected: false })),
  };
  // expose listeners for tests
  svc.__listeners = listeners;
  return { __esModule: true, default: svc };
});

import React from "react";
import { renderHook, act } from "@testing-library/react";
import { useRealTimeData, useDashboardData } from "./useRealTimeData";
import { AuthProvider } from "../contexts/AuthContext";

const wsMock = require("../services/websocketService").default;
const evt = wsMock.__listeners;

describe("useRealTimeData", () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    evt.clear();
  });

  test("auto-connects, authenticates, and subscribes", async () => {
    wsMock.isConnected.mockReturnValueOnce(false);
    const { result } = renderHook(() => useRealTimeData(["dashboard"], { autoConnect: true }), { wrapper });
    await act(async () => {});
    expect(wsMock.connect).toHaveBeenCalled();
    // simulate connection by invoking registered callback
    const connectedCb = wsMock.on.mock.calls.find(([ev]) => ev === "connected")[1];
    connectedCb();
    await act(async () => {});
    // No user by default, but subscribe called
    expect(wsMock.subscribe).toHaveBeenCalledWith(["dashboard"]);
    expect(result.current.connected).toBe(true);
  });

  test("receives data events and updates state", async () => {
    const { result } = renderHook(() => useRealTimeData(["dashboard"], { autoConnect: false }), { wrapper });
    await act(async () => {});
    // find the registered dashboard callback and invoke it
    const dashboardCb = wsMock.on.mock.calls.find(([ev]) => ev === "dashboard")[1];
    act(() => {
      dashboardCb({ a: 1 });
    });
    expect(result.current.dashboardData).toEqual(expect.objectContaining({ a: 1, receivedAt: expect.any(String) }));
  });

  test("exposes specialized hooks", async () => {
    const { result } = renderHook(() => useDashboardData({ autoConnect: false }), { wrapper });
    expect(result.current).toHaveProperty("dashboardData");
  });
});