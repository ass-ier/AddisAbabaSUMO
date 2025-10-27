import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import UserManagement from "./UserManagement";
import axios from "axios";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "root", role: "super_admin" } }),
}));

jest.mock("axios");

describe("UserManagement", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: {} });
  });


  test("loads users and can add with validation", async () => {
    axios.get.mockResolvedValueOnce({ data: [{ _id: "1", username: "bob", role: "operator", region: "A", createdAt: Date.now() }] });
    render(<UserManagement />);
    await act(async () => {});
    expect(screen.getByText(/System Users/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Add New User/));
    // invalid username
    fireEvent.change(screen.getByLabelText(/Username:/), { target: { value: "1" } });
    expect(screen.getByText(/must start with a letter/)).toBeInTheDocument();
    // valid fields
    fireEvent.change(screen.getByLabelText(/Username:/), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/Password:/), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText(/Role:/), { target: { value: "analyst" } });
    fireEvent.change(screen.getByLabelText(/Region:/), { target: { value: "Addis" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Create User/ }));
    });
    expect(axios.post).toHaveBeenCalled();
  });
});