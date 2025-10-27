import { render, screen } from "@testing-library/react";
import React from "react";

// Jest cannot resolve ESM react-router-dom in some setups; stub minimal API for App rendering
jest.mock("react-router-dom", () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: () => <div>Routes</div>,
  Route: () => null,
  Navigate: () => <div>Navigate</div>,
  useLocation: () => ({ pathname: "/" }),
}), { virtual: true });

import App from "./App";

test("renders App with stubbed router", () => {
  render(<App />);
  expect(screen.getByText(/Routes/i)).toBeInTheDocument();
});
