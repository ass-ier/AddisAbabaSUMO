// Feature flags for runtime-toggleable modules
// Use env vars to enable during development without code changes
// REACT_APP_FEATURE_EMERGENCY_OPS=true to enable the Emergency Operations module

export const FEATURES = {
  emergencyOps:
    String(process.env.REACT_APP_FEATURE_EMERGENCY_OPS || "false").toLowerCase() ===
    "true",
};