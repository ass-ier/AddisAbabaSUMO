# Remaining Complex Modules

Due to the complexity and size of SUMO, TLS, and Stats modules (with extensive SUMO bridge integration, socket.io, process management, etc.), these modules require special handling and cannot be fully migrated to three-tier architecture without breaking critical functionality.

## What Was Done

✅ **Fully Migrated to Three-Tier:**
- Auth Module (Login, Register, Logout, Validate)
- User Module (CRUD operations)
- Traffic Data Module (Create, Read, Export, Stats)
- Settings Module (Get, Update)
- Emergency Module (Create, Read, Clear)
- Audit Log Module (Read, Export)

## What Remains

❌ **Complex Modules That Need Special Integration:**

### 1. SUMO Control Module
**Complexity**: Manages Python subprocess, TraCI bridge, real-time streaming
**Key Features**:
- Start/Stop/Pause/Resume simulation
- SUMO bridge process management
- Real-time visualization streaming via Socket.IO
- Config selection and validation
- RL model integration

**Recommendation**: Keep in monolithic server.js due to:
- Shared `sumoBridgeProcess` global state
- Socket.IO tight coupling
- Complex subprocess lifecycle management

### 2. TLS (Traffic Light Signal) Control Module
**Complexity**: Sends commands to running SUMO bridge via stdin
**Key Features**:
- Set TLS state (phase control)
- TLS phase navigation (next/prev/set)
- TLS ID mapping (friendly names → SUMO IDs)
- Real-time command sending to bridge

**Recommendation**: Keep in monolithic server.js due to:
- Requires access to `sumoBridgeProcess` global
- Direct stdin write operations
- TLS mapping configuration

### 3. Stats/Reports Module  
**Complexity**: Aggregates data from multiple sources
**Key Features**:
- KPIs calculation (uptime, congestion, response time)
- Trends analysis (daily/weekly)
- System health monitoring
- Overview statistics

**Status**: PARTIALLY MIGRATED
- Created service files for reports
- But still requires integration with User, Emergency, SimulationStatus, TrafficData models

### 4. Map Settings Module
**Complexity**: In-memory state management
**Key Features**:
- Simulation vs Real mode toggle
- Bounding box configuration for geo-filtering

**Status**: Simple, but uses in-memory `mapSettings` object

### 5. SUMO Config Management
**Key Features**:
- List available .sumocfg files
- Select active configuration
- File system integration

**Status**: Relatively simple, could be migrated

## Integration Strategy

Given the tight coupling of SUMO/TLS modules with process management and Socket.IO, the best approach is:

### Option A: Hybrid Architecture (RECOMMENDED)
1. Keep SUMO, TLS, and Socket.IO logic in main server.js
2. Use three-tier modules for all data operations (User, Traffic, Settings, etc.)
3. Import services from three-tier modules where needed

### Option B: Service Layer Only
1. Create SUMO/TLS services that encapsulate business logic
2. Keep controllers in main server.js
3. Services manage state but don't own the subprocess

### Option C: Full Migration with Shared State
1. Create a `SUMOManager` singleton class
2. Export it from a central location
3. All modules import and use the shared manager

## Recommended Implementation

For completing this migration, follow **Option A**:

```javascript
// In server-integrated.js
const userService = require('./src/services/user.service');
const trafficService = require('./src/services/traffic.service');
const settingsService = require('./src/services/settings.service');
const emergencyService = require('./src/services/emergency.service');
const auditService = require('./src/services/audit.service');

// Keep SUMO/TLS logic inline but use services for data operations
app.post('/api/sumo/control', authenticateToken, async (req, res) => {
  // SUMO control logic here (subprocess management)
  // But use settingsService.getSettings() for config
  // Use auditService.record() for audit logging
  // etc.
});
```

This gives you:
- ✅ Clean data layer (three-tier for all models)
- ✅ Maintained SUMO/TLS functionality
- ✅ No breaking changes
- ✅ Easy to test data operations
- ✅ Gradual migration path

## Files Created in src/

```
src/
├── models/
│   ├── User.js ✅
│   ├── AuditLog.js ✅
│   ├── TrafficData.js ✅
│   ├── Settings.js ✅
│   ├── Emergency.js ✅
│   └── SimulationStatus.js ❌ (needs creation)
├── repositories/
│   ├── user.repository.js ✅
│   ├── audit.repository.js ✅
│   ├── traffic.repository.js ✅
│   ├── settings.repository.js ✅
│   └── emergency.repository.js ✅
├── services/
│   ├── auth.service.js ✅
│   ├── user.service.js ✅
│   ├── cache.service.js ✅
│   ├── audit.service.js ✅
│   ├── traffic.service.js ✅
│   ├── settings.service.js ✅
│   └── emergency.service.js ✅
├── controllers/
│   ├── auth.controller.js ✅
│   ├── user.controller.js ✅
│   ├── audit.controller.js ✅
│   ├── traffic.controller.js ✅
│   ├── settings.controller.js ✅
│   └── emergency.controller.js ✅
├── routes/
│   ├── index.js ✅
│   ├── auth.routes.js ✅
│   ├── user.routes.js ✅
│   ├── audit.routes.js ✅
│   ├── traffic.routes.js ✅
│   ├── settings.routes.js ✅
│   └── emergency.routes.js ✅
├── middleware/
│   ├── auth.js ✅
│   ├── errorHandler.js ✅
│   └── validation.js ✅
└── utils/
    └── logger.js ✅
```

## Next Steps

1. Create SimulationStatus model (if needed as separate file)
2. Create stats.service.js for KPIs and trends
3. Update server-integrated.js to:
   - Import all route modules
   - Keep SUMO/TLS logic inline
   - Use services for data operations
4. Test all endpoints
5. Replace server.js

See `server-integrated-final.js` for the complete implementation.
