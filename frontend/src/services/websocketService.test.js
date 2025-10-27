jest.useFakeTimers();

describe("websocketService", () => {
  beforeEach(() => {
    const ws = require("./websocketService").default;
    ws.disconnect();
  });

  test("on/off listeners and triggerEvent work", () => {
    const ws = require("./websocketService").default;
    const cb = jest.fn();
    ws.on("alerts", cb);
    ws.triggerEvent("alerts", { msg: 1 });
    expect(cb).toHaveBeenCalledWith({ msg: 1 });
    ws.off("alerts", cb);
    ws.triggerEvent("alerts", { msg: 2 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("authenticate and subscribe/unsubscribe manage state", () => {
    const ws = require("./websocketService").default;
    // Patch socket and state to simulate connected
    ws.socket = { connected: true, emit: jest.fn(), on: jest.fn(), disconnect: jest.fn() };
    ws.connected = true;
    ws.authenticate({ username: "alice" });
    ws.subscribe(["dashboard", "traffic"]);
    expect(ws.getSubscriptions()).toEqual(expect.arrayContaining(["dashboard", "traffic"]));
    ws.unsubscribe(["traffic"]);
    expect(ws.getSubscriptions()).toEqual(["dashboard"]);
  });

  test("heartbeat pings when connected", () => {
    const ws = require("./websocketService").default;
    ws.socket = { connected: true, emit: jest.fn(), on: jest.fn(), disconnect: jest.fn() };
    ws.connected = true;
    ws.startHeartbeat();
    jest.advanceTimersByTime(31000);
    expect(ws.socket.emit).toHaveBeenCalledWith("ping");
    ws.stopHeartbeat();
  });

  test("disconnect clears listeners and subscriptions", () => {
    const ws = require("./websocketService").default;
    ws.socket = { connected: true, emit: jest.fn(), on: jest.fn(), disconnect: jest.fn() };
    ws.connected = true;
    ws.on("alerts", () => {});
    ws.subscribe(["a"]);
    ws.disconnect();
    expect(ws.isConnected()).toBe(false);
    expect(ws.getSubscriptions()).toEqual([]);
  });

  test("attemptReconnect retries up to max attempts", () => {
    const ws = require("./websocketService").default;
    ws.connect = jest.fn().mockRejectedValue(new Error("fail"));
    ws.maxReconnectAttempts = 2;
    ws.attemptReconnect();
    jest.advanceTimersByTime(1000 + 2000 + 1);
    expect(ws.connect).toHaveBeenCalled();
  });
});
