import React from "react";
import { render, screen } from "@testing-library/react";
import TrafficLightPhaseViz, { TrafficLightPhasePreview } from "./TrafficLightPhaseViz";

describe("TrafficLightPhaseViz", () => {
  test("renders phase text and arrows", () => {
    render(<TrafficLightPhaseViz phaseState="ggrryyrrggo" size={200} showLabels />);
    expect(screen.getByText(/ggrryyrrggo/i)).toBeInTheDocument();
    // There should be movement labels L,S,R repeated for directions
    expect(screen.getAllByText("L").length).toBeGreaterThan(0);
    expect(screen.getAllByText("S").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R").length).toBeGreaterThan(0);
  });

  test("preview renders segments equal to state length", () => {
    render(<TrafficLightPhasePreview phaseState="gyrro" width={100} height={10} />);
    const segments = screen.getAllByTitle(/Signal \d+: [GYRO]/i);
    expect(segments.length).toBe(5);
  });
});