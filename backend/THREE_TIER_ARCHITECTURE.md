# 🏗️ Three-Tier Architecture Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER (Tier 1)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes → Controllers → Request/Response Handling    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│            BUSINESS LOGIC LAYER (Tier 2)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services → Business Rules → Data Validation         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              DATA ACCESS LAYER (Tier 3)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Repositories → Models → Database Operations         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
backend/
├── src/
│   ├── routes/              # Tier 1: Presentation Layer
│   │   ├── index.js         # Route aggregator
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── traffic.routes.js
│   │   ├── sumo.routes.js
│   │   ├── tls.routes.js
│   │   └── settings.routes.js
│   │
│   ├── controllers/         # Tier 1: Request Handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── traffic.controller.js
│   │   ├── sumo.controller.js
│   │   ├── tls.controller.js
│   │   └── settings.controller.js
│   │
│   ├── services/            # Tier 2: Business Logic
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── traffic.service.js
│   │   ├── sumo.service.js
│   │   ├── tls.service.js
│   │   ├── cache.service.js
│   │   └── audit.service.js
│   │
│   ├── repositories/        # Tier 3: Data Access
│   │   ├── user.repository.js
│   │   ├── traffic.repository.js
│   │   ├── settings.repository.js
│   │   ├── audit.repository.js
│   │   └── emergency.repository.js
│   │
│   ├── models/              # Tier 3: Data Schemas
│   │   ├── User.js
│   │   ├── TrafficData.js
│   │   ├── SimulationStatus.js
│   │   ├── Settings.js
│   │   ├── AuditLog.js
│   │   └── Emergency.js
│   │
│   ├── middleware/          # Cross-cutting concerns
│   │   ├── auth.js
│   │   ├── validation.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   │
│   ├── config/              # Configuration
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── sumo.js
│   │   └── index.js
│   │
│   └── utils/               # Utilities
│       ├── logger.js
│       ├── validators.js
│       └── helpers.js
│
├── server.js                # Application entry point
└── package.json
```

---

## Layer Responsibilities

### **Tier 1: Presentation Layer**

**Components:** Routes + Controllers

**Responsibilities:**
- Handle HTTP requests/responses
- Route mapping
- Request validation (syntax)
- Response formatting
- Error responses
- Status codes

**Rules:**
- ❌ NO business logic
- ❌ NO direct database access
- ✅ Call service methods only
- ✅ Handle HTTP concerns only

**Example Flow:**
```
Request → Route → Controller → Service → Response
```

---

### **Tier 2: Business Logic Layer**

**Components:** Services

**Responsibilities:**
- Business rules enforcement
- Data validation (business rules)
- Transaction management
- Service orchestration
- Caching logic
- External API calls
- SUMO bridge communication

**Rules:**
- ❌ NO HTTP handling (req/res)
- ❌ NO direct model access (use repositories)
- ✅ Pure business logic
- ✅ Reusable across controllers
- ✅ Testable independently

---

### **Tier 3: Data Access Layer**

**Components:** Repositories + Models

**Responsibilities:**
- Database operations (CRUD)
- Query building
- Data mapping
- Schema definition
- Relationships
- Indexes

**Rules:**
- ❌ NO business logic
- ❌ NO HTTP concerns
- ✅ Database operations only
- ✅ Return plain data
- ✅ Handle DB errors

---

## Example Implementation

### 1. Model (Tier 3)
```javascript
// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'operator', 'analyst'] },
  region: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
```

### 2. Repository (Tier 3)
```javascript
// src/repositories/user.repository.js
const User = require('../models/User');

class UserRepository {
  async findById(id) {
    return await User.findById(id).select('-password');
  }

  async findByUsername(username) {
    return await User.findOne({ username });
  }

  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  async update(id, updates) {
    return await User.findByIdAndUpdate(id, updates, { new: true });
  }

  async delete(id) {
    return await User.findByIdAndDelete(id);
  }

  async findAll(query = {}) {
    return await User.find(query).select('-password');
  }

  async count(query = {}) {
    return await User.countDocuments(query);
  }
}

module.exports = new UserRepository();
```

### 3. Service (Tier 2)
```javascript
// src/services/user.service.js
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const cacheService = require('./cache.service');
const { AppError } = require('../middleware/errorHandler');

class UserService {
  async createUser(userData) {
    // Business validation
    const existing = await userRepository.findByUsername(userData.username);
    if (existing) {
      throw new AppError('User already exists', 400);
    }

    // Business logic: hash password
    userData.password = await bcrypt.hash(userData.password, 10);

    // Create user
    const user = await userRepository.create(userData);

    // Invalidate cache
    await cacheService.del('users:list');

    return user;
  }

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async getAllUsers() {
    // Try cache first
    const cached = await cacheService.get('users:list');
    if (cached) return cached;

    // Get from DB
    const users = await userRepository.findAll();

    // Cache result
    await cacheService.set('users:list', users);

    return users;
  }

  async updateUser(id, updates) {
    // Business validation
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const user = await userRepository.update(id, updates);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Invalidate cache
    await cacheService.del('users:list');

    return user;
  }

  async deleteUser(id) {
    const deleted = await userRepository.delete(id);
    if (!deleted) {
      throw new AppError('User not found', 404);
    }

    // Invalidate cache
    await cacheService.del('users:list');

    return deleted;
  }
}

module.exports = new UserService();
```

### 4. Controller (Tier 1)
```javascript
// src/controllers/user.controller.js
const userService = require('../services/user.service');
const { asyncHandler } = require('../middleware/errorHandler');

class UserController {
  // Get all users
  getAllUsers = asyncHandler(async (req, res) => {
    const users = await userService.getAllUsers();
    res.json(users);
  });

  // Get user by ID
  getUserById = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  });

  // Create user
  createUser = asyncHandler(async (req, res) => {
    const user = await userService.createUser(req.body);
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  });

  // Update user
  updateUser = asyncHandler(async (req, res) => {
    const user = await userService.updateUser(req.params.id, req.body);
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  });

  // Delete user
  deleteUser = asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id);
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  });
}

module.exports = new UserController();
```

### 5. Routes (Tier 1)
```javascript
// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Get all users (super_admin only)
router.get(
  '/',
  requireRole('super_admin'),
  userController.getAllUsers
);

// Get user by ID
router.get('/:id', userController.getUserById);

// Create user
router.post(
  '/',
  requireRole('super_admin'),
  validate(schemas.register),
  userController.createUser
);

// Update user
router.put(
  '/:id',
  requireRole('super_admin'),
  validate(schemas.updateUser),
  userController.updateUser
);

// Delete user
router.delete(
  '/:id',
  requireRole('super_admin'),
  userController.deleteUser
);

module.exports = router;
```

### 6. Route Aggregator
```javascript
// src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const trafficRoutes = require('./traffic.routes');
const sumoRoutes = require('./sumo.routes');
const tlsRoutes = require('./tls.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/traffic-data', trafficRoutes);
router.use('/sumo', sumoRoutes);
router.use('/tls', tlsRoutes);

module.exports = router;
```

### 7. Server.js (Entry Point)
```javascript
// server.js
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');
require('dotenv').config();

const logger = require('./src/utils/logger');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const routes = require('./src/routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(compression());
app.use(morgan('combined', { stream: logger.stream }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'healthy' }));

// API routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

---

## Benefits of Three-Tier Architecture

### ✅ **Separation of Concerns**
- Each layer has a single responsibility
- Easy to understand and maintain
- Changes isolated to specific layers

### ✅ **Testability**
- Test each layer independently
- Mock dependencies easily
- Higher test coverage

### ✅ **Reusability**
- Services reusable across controllers
- Repositories reusable across services
- DRY principle

### ✅ **Scalability**
- Layers can scale independently
- Easy to optimize specific layers
- Microservices-ready

### ✅ **Maintainability**
- Clear structure for new developers
- Easy to locate code
- Consistent patterns

---

## Common Patterns

### Pattern 1: Cache-Aside
```javascript
// In Service Layer
async getData(id) {
  // 1. Check cache
  const cached = await cacheService.get(`data:${id}`);
  if (cached) return cached;

  // 2. Get from database
  const data = await repository.findById(id);

  // 3. Cache result
  await cacheService.set(`data:${id}`, data, 300);

  return data;
}
```

### Pattern 2: Transaction Management
```javascript
// In Service Layer
async createUserWithProfile(userData, profileData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await userRepository.create(userData, session);
    const profile = await profileRepository.create({
      ...profileData,
      userId: user._id
    }, session);

    await session.commitTransaction();
    return { user, profile };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### Pattern 3: Service Orchestration
```javascript
// In Service Layer
async startSimulation(config) {
  // 1. Validate business rules
  if (await this.isSimulationRunning()) {
    throw new AppError('Simulation already running', 400);
  }

  // 2. Update status
  await statusRepository.update({ isRunning: true });

  // 3. Start SUMO bridge
  const process = await sumoService.startBridge(config);

  // 4. Emit event
  socketService.emit('simulationStarted', { config });

  // 5. Audit log
  await auditService.log('start_simulation', config);

  return process;
}
```

---

## Migration Strategy

### Step 1: Move Models (1 hour)
```bash
# Move existing models to src/models/
mv User.js src/models/
mv TrafficData.js src/models/
# ... etc
```

### Step 2: Create Repositories (2-3 hours)
- Extract all database queries from server.js
- Create repository classes
- Implement CRUD methods

### Step 3: Create Services (3-4 hours)
- Extract business logic from server.js
- Create service classes
- Use repositories for data access

### Step 4: Create Controllers (2-3 hours)
- Extract HTTP handling from server.js
- Create controller classes
- Call services for business logic

### Step 5: Create Routes (1-2 hours)
- Extract route definitions
- Create route files
- Apply middleware

### Step 6: Update server.js (1 hour)
- Clean up and simplify
- Import route aggregator
- Add middleware

**Total Estimated Time:** 10-15 hours

---

## Testing Strategy

### Unit Tests
- Test services in isolation
- Mock repositories
- Test business logic

### Integration Tests
- Test controller → service → repository flow
- Use test database
- Test actual queries

### E2E Tests
- Test complete API flows
- Use test environment
- Test user scenarios

---

## Best Practices

### ✅ DO:
- Keep controllers thin
- Put business logic in services
- Use repositories for all DB access
- Return DTOs from services
- Handle errors in services
- Use dependency injection
- Write tests for each layer

### ❌ DON'T:
- Put business logic in controllers
- Access database from controllers
- Put HTTP logic in services
- Mix layer responsibilities
- Skip error handling
- Hardcode dependencies

---

## Next Steps

1. **Review this guide** - Understand the architecture
2. **Create sample implementation** - Start with one feature
3. **Migrate gradually** - Don't rewrite everything at once
4. **Write tests** - Ensure nothing breaks
5. **Refactor** - Clean up as you go

---

**Migration Priority:**
1. User management (simplest)
2. Traffic data
3. SUMO control
4. TLS control
5. Emergency handling

Start with user management to learn the pattern!
