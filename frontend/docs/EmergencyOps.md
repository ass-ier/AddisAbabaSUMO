# Emergency Operations Module

Feature-flagged, additive module that renders live emergency vehicles, their routes, and summary UI without altering existing map or heatmap logic.

Feature flag
- REACT_APP_FEATURE_EMERGENCY_OPS=true

Files added
- src/config/features.js
- src/services/emergencyFeed.js
- src/modules/emergency/EmergencyOps.jsx
- src/modules/emergency/EmergencyOps.css

How to enable
1) Create .env.local with:
   REACT_APP_FEATURE_EMERGENCY_OPS=true
   REACT_APP_SERVER_URL=http://localhost:5001
   REACT_APP_API_BASE=http://localhost:5001
   # Live mapping from existing sim feed (optional overrides)
   REACT_APP_EMERGENCY_VTYPES=ambulance,firetruck,police,vip,vip_escort
   REACT_APP_EMERGENCY_VCLASS=emergency,authority
   REACT_APP_EMERGENCY_MATCH_ANY=false
   # Socket namespace/path overrides (optional)
   REACT_APP_EMERGENCY_NAMESPACE=/
   REACT_APP_EMERGENCY_PATH=
   # Optional snapshot endpoint (off by default)
   REACT_APP_ENABLE_EMERGENCY_SNAPSHOT=false
2) Start frontend as usual.
3) Navigate to /admin/emergencies.

Live data sources
- The module subscribes to the existing "viz"/"sumoData" socket events and derives emergency vehicles based on SUMO vType/vClass.
  - Emergency vTypes (default): ambulance, firetruck, police, vip, vip_escort
  - Emergency vClass (default): emergency, authority
  - To allow all vehicles temporarily, set REACT_APP_EMERGENCY_MATCH_ANY=true.
- Optional dedicated events are also supported if your bridge publishes them directly:
  - Vehicles: "emergencyVehicles" or "emergency"
  - Routes: "emergencyRoutes" or "route"
  - Request route: client emits "getEmergencyRoute" with { vehicleId, routeId }
- Optional HTTP snapshot (disabled by default): GET /api/emergency/snapshot returns { vehicles: [...], routes: [...] }

Emergency feed contract
- Vehicles: { timestamp, vehicles: [ { vehicleId, x, y, speed, heading, vehicleType, emergencyState, routeId? } ] }
- Routes: { timestamp, routes: [ { routeId, coords: [ [x,y], ... ], origin?, destination?, eta?, assignedVehicleId? } ] }

Dev/testing shortcuts
- With the page Debug toggle ON, bottom-right buttons:
  - "Inject 3 vehicles" – adds sample vehicles
  - "Inject route (selected)" – synthesizes a route for the selected vehicle
  - "Start demo motion" / "Stop" – animates injected vehicles locally (dev only)

Troubleshooting
- No vehicles on map/list:
  - Ensure the sim WS feed contains vehicle x,y (SUMO net coords). CRS.Simple requires x,y; if you only have lat/lon, update the bridge to include x,y or expose the existing transform.
  - If your vType/vClass names differ, set REACT_APP_EMERGENCY_VTYPES / REACT_APP_EMERGENCY_VCLASS accordingly and restart the dev server.
  - Toggle "Enable overlay" and filter checkboxes in the UI.
- 404 on snapshot: leave REACT_APP_ENABLE_EMERGENCY_SNAPSHOT=false unless your bridge exposes /api/emergency/snapshot.

Non-destructive design
- Dedicated emergency socket client layered alongside existing websocketService; heatmap and other feeds untouched.
- All code is isolated and gated by a feature flag.

Rollback plan
- Flip REACT_APP_FEATURE_EMERGENCY_OPS=false (or remove). No code removal required.

Performance notes
- Rendering in a separate overlay with throttling and viewport culling.
- CRS.Simple rendering using parseSumoNetXml geometry.
- Future: worker-based downsampling and batching can be enabled if needed.
