import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Navigation from "./Navigation";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "root", role: "super_admin" }, logout: jest.fn() }),
}));

jest.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ children }) => <a>{children}</a>,
  useLocation: () => ({ pathname: "/dashboard" }),
}));

describe("Navigation", () => {
  test("renders links for super_admin and toggles theme", () => {
    render(<Navigation />);
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/Users/)).toBeInTheDocument();
    const themeBtn = screen.getByRole("button", { name: /Switch to/i });
    fireEvent.click(themeBtn);
  });
});