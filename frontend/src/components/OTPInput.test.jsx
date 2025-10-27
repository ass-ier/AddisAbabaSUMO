import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import OTPInput from "./OTPInput";

describe("OTPInput", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ verified: true }),
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch.mockRestore();
  });

  const setup = () => {
    const onComplete = jest.fn();
    const onResend = jest.fn();
    render(
      <OTPInput length={4} identifier="user@example.com" purpose="registration" onComplete={onComplete} onResend={onResend} />
    );
    const inputs = screen.getAllByRole("textbox");
    return { inputs, onComplete, onResend };
  };

  test("fills inputs and auto-verifies success", async () => {
    const { inputs, onComplete } = setup();
    for (let i = 0; i < inputs.length; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }
    // auto verify
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/otp\/verify/),
      expect.objectContaining({ method: "POST" })
    );
    // wait microtask
    await act(async () => {});
    expect(onComplete).toHaveBeenCalledWith("1234", true);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });

  test("paste fills all and verifies", async () => {
    const { inputs, onComplete } = setup();
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => "9876",
      },
      preventDefault: () => {},
    });
    await act(async () => {});
    expect(onComplete).toHaveBeenCalledWith("9876", true);
  });

  test("handles verify failure and resets", async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ verified: false, message: "bad" }) });
    const { inputs, onComplete } = setup();
    for (let i = 0; i < inputs.length; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }
    await act(async () => {});
    expect(onComplete).toHaveBeenCalledWith("1234", false);
    expect(screen.getByText(/Invalid OTP|Failed to verify|bad/i)).toBeInTheDocument();
    // inputs cleared
    expect(inputs[0].value).toBe("");
  });

  test("resend triggers endpoint and timer", async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const { onResend } = setup();
    fireEvent.click(screen.getByText(/Resend OTP/i));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/otp\/resend/),
      expect.objectContaining({ method: "POST" })
    );
    await act(async () => {});
    expect(onResend).toHaveBeenCalled();
    expect(screen.getByText(/Resend OTP in 60s/)).toBeInTheDocument();
    // countdown
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/Resend OTP in 58s/)).toBeInTheDocument();
  });

  test("keyboard navigation and backspace", () => {
    const { inputs } = setup();
    fireEvent.change(inputs[0], { target: { value: "1" } });
    fireEvent.keyDown(inputs[1], { key: "Backspace" }); // clears 2nd
    expect(inputs[1].value).toBe("");
    fireEvent.keyDown(inputs[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(inputs[0]);
    fireEvent.keyDown(inputs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(inputs[1]);
  });
});