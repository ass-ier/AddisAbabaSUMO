import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Login from "./Login";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: jest.fn(async (u, p) => ({ username: u, role: "super_admin" })),
  }),
}));

jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => jest.fn(),
}));

describe("Login", () => {
  test("validates empty credentials and toggles password visibility", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/enter both username and password/i);
    const pwdToggle = screen.getByRole("button", { name: /show password|hide password/i });
    fireEvent.click(pwdToggle);
  });

  test("demo login fills fields", () => {
    render(<Login />);
    fireEvent.click(screen.getByText(/Super Admin:/));
    expect(screen.getByLabelText(/Username/i).value).toBe("admin");
  });

  test("shows deactivation modal on 403", async () => {
    const { useAuth } = require("../contexts/AuthContext");
    useAuth().login.mockRejectedValueOnce(Object.assign(new Error("Account deactivated"), { status: 403 }));
    render(<Login />);
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: "u" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: "p" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /login/i }));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});