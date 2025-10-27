import { msToKph, kphToMs } from "./speed";

describe("speed utils", () => {
  test("msToKph converts correctly", () => {
    expect(msToKph(0)).toBe(0);
    expect(msToKph(1)).toBeCloseTo(3.6, 5);
    expect(msToKph(13.9)).toBeCloseTo(50.04, 2);
    expect(msToKph(-5)).toBeCloseTo(-18, 5);
  });

  test("msToKph handles invalid", () => {
    expect(msToKph("foo")).toBe(0);
    expect(msToKph(NaN)).toBe(0);
    expect(msToKph(undefined)).toBe(0);
    expect(msToKph(null)).toBe(0);
    expect(msToKph(Infinity)).toBe(0);
  });

  test("kphToMs converts correctly", () => {
    expect(kphToMs(0)).toBe(0);
    expect(kphToMs(3.6)).toBeCloseTo(1, 5);
    expect(kphToMs(50)).toBeCloseTo(13.8889, 3);
    expect(kphToMs(-18)).toBeCloseTo(-5, 5);
  });

  test("kphToMs handles invalid", () => {
    expect(kphToMs("bar")).toBe(0);
    expect(kphToMs(NaN)).toBe(0);
    expect(kphToMs(undefined)).toBe(0);
    expect(kphToMs(null)).toBe(0);
    expect(kphToMs(Infinity)).toBe(0);
  });
});