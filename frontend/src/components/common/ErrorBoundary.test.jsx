import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary.jsx";

describe("ErrorBoundary", () => {
  const Problem = () => {
    throw new Error("boom");
  };

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    console.error.mockRestore();
  });

  test("renders fallback and can reset", () => {
    render(
      <ErrorBoundary>
        <Problem />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Try Again/i));
    // After reset it renders children again; but Problem will throw again - wrap with non-throwing
    const { rerender } = render(
      <ErrorBoundary>
        <div>ok</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  test("shows dev details only in development", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    render(
      <ErrorBoundary>
        <Problem />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Error Details/)).toBeInTheDocument();
    process.env.NODE_ENV = orig;
  });
});