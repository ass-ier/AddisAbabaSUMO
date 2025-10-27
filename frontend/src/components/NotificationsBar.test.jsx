import React from "react";
import { render, screen } from "@testing-library/react";
import NotificationsBar from "./NotificationsBar";

jest.useFakeTimers();

describe("NotificationsBar", () => {
  test("renders notifications and auto-dismisses", () => {
    render(<NotificationsBar />);
    const evt = new CustomEvent("notify", { detail: { message: "Hello", type: "success" } });
    // fire inside act
    require("react-dom/test-utils").act(() => {
      window.dispatchEvent(evt);
    });
    expect(screen.getByText("Hello")).toBeInTheDocument();
    // auto dismiss after 4s
    require("react-dom/test-utils").act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("Hello")).toBeNull();
  });
});