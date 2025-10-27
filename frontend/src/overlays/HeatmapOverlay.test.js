import React from "react";
import { render } from "@testing-library/react";

// Mock react-leaflet useMap to provide a fake map API
jest.mock("react-leaflet");

import HeatmapOverlay from "./HeatmapOverlay";

const leafletMock = require("react-leaflet");
const containerEl = leafletMock.__container;

describe("HeatmapOverlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders null and attaches canvases, updates with vehicles", () => {
    const vehicles = [
      { id: 1, netLat: 0, netLng: 0, speed: 5 },
      { id: 2, y: 10, x: 10, speed: 20 },
    ];
    const { container: root } = render(
      <HeatmapOverlay enabled vehicles={vehicles} settings={{ fps: 30 }} />
    );
    expect(root.firstChild).toBeNull();
    // Run RAF a bit
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(34);
    }
    // canvas should have been attached to map container
    expect(containerEl.querySelector("canvas")).not.toBeNull();
  });
});
