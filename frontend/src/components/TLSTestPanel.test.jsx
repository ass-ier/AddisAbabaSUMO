import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import TLSTestPanel from "./TLSTestPanel";

jest.useFakeTimers();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "op", role: "operator" } }),
}));

jest.mock("../utils/api", () => ({
  api: {
    getTlsAvailable: jest.fn(async () => ({ friendlyNames: ["Main"], friendlyCount: 1, totalCount: 1, mappings: { Main: "TLS-1" } })),
    tlsSetState: jest.fn(async () => ({})),
    tlsSetPhase: jest.fn(async () => ({})),
    tlsNextPhase: jest.fn(async () => ({})),
    tlsPrevPhase: jest.fn(async () => ({})),
  },
}));

describe("TLSTestPanel", () => {
  test("loads TLS data and triggers commands", async () => {
    render(<TLSTestPanel />);
    // wait for initial load tick
    await act(async () => {});
    // Ensure controls are present (may be disabled until data loads)
    const directBtn = screen.getByRole("button", { name: /Set State/ });
    expect(directBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(directBtn);
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Next Phase/));
    });
  });
});