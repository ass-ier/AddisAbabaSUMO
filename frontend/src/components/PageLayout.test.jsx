import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PageLayout from "./PageLayout";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "alice" }, logout: jest.fn() }),
}));

describe("PageLayout", () => {
  test("renders title, subtitle and logout button", () => {
    render(
      <PageLayout title="T" subtitle="S">
        <div>child</div>
      </PageLayout>
    );
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /logout/i });
    fireEvent.click(btn);
  });
});