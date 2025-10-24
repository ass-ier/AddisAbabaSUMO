export const msToKph = (ms) => {
  const v = Number(ms);
  if (!Number.isFinite(v)) return 0;
  return v * 3.6;
};

export const kphToMs = (kph) => {
  const v = Number(kph);
  if (!Number.isFinite(v)) return 0;
  return v / 3.6;
};