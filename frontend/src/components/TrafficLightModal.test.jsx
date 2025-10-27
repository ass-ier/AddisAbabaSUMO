import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import TrafficLightModal from "./TrafficLightModal";

jest.useFakeTimers();

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "op", role: "operator" } }),
}));

jest.mock("../utils/tlsConfigParser", () => ({
  loadTlsConfigurations: jest.fn(() => Promise.reject(new Error("no xml"))),
  getAvailablePhases: jest.fn(),
  isValidPhaseIndex: jest.fn(() => true),
}));

jest.mock("../utils/api", () => ({
  api: {
    tlsSetState: jest.fn(async () => ({})),
    tlsSetPhase: jest.fn(async () => ({})),
    tlsNextPhase: jest.fn(async () => ({})),
    tlsPrevPhase: jest.fn(async () => ({})),
  },
}));

describe("TrafficLightModal", () => {
  test("renders open modal and allows phase change", async () => {
    render(
      <TrafficLightModal
        tlsId="TLS-1"
        isOpen={true}
        onClose={() => {}}
        timing={{ currentIndex: 0, nextIndex: 1, remaining: 10 }}
        program={{ phases: [{ index: 0, state: "ggrr" }] }}
      />
    );
    await act(async () => {});
    // Click quick next phase
    await act(async () => {
      fireEvent.click(screen.getByText(/Next Phase/));
    });
  });
});