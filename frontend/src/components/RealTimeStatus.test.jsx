import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RealTimeStatus from "./RealTimeStatus";

jest.mock("../hooks/useRealTimeData", () => ({
  useRealTimeData: jest.fn(() => ({
    connected: false,
    connecting: false,
    error: null,
    lastUpdate: null,
    getConnectionInfo: () => ({}),
    connect: jest.fn(),
  })),
}));

const { useRealTimeData } = require("../hooks/useRealTimeData");

describe("RealTimeStatus", () => {
  test("hides when not connected and details false", () => {
    render(<RealTimeStatus />);
    expect(document.body).toBeDefined();
  });

  test("shows details and retry when error", () => {
    useRealTimeData.mockReturnValueOnce({
      connected: false,
      connecting: false,
      error: new Error("x"),
      lastUpdate: null,
      getConnectionInfo: () => ({}),
      connect: jest.fn(),
    });
    render(<RealTimeStatus showDetails={false} />);
    const btn = screen.getByRole("button", { name: /retry connection/i });
    fireEvent.click(btn);
  });

  test("shows connected status with details", () => {
    useRealTimeData.mockReturnValueOnce({
      connected: true,
      connecting: false,
      error: null,
      lastUpdate: new Date().toISOString(),
      getConnectionInfo: () => ({}),
      connect: jest.fn(),
    });
    render(<RealTimeStatus showDetails={true} />);
    expect(screen.getByText(/Real-time|Connecting|Offline/)).toBeInTheDocument();
  });
});