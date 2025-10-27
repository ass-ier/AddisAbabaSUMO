import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Reports from "./Reports";
import axios from "axios";

jest.mock("axios");

jest.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: "r", role: "analyst" }, logout: jest.fn() }) }));

beforeEach(() => {
  axios.get.mockReset();
  axios.get.mockResolvedValue({ data: [] });
});

describe("Reports", () => {
  test("generates a report and lists it", async () => {
    render(<Reports />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generate Report/ }));
    });
    expect(await screen.findByText(/Generated Reports/)).toBeInTheDocument();
  });
});