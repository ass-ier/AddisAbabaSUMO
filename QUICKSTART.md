# 🚀 Quick Start Guide - Three-Tier Backend

## Start the Backend (New Architecture)

```powershell
# Navigate to backend directory
cd C:\GitHub\AddisAbaba\AddisAbabaSUMO\backend

# Install dependencies (if not already done)
npm install

# Start the server
npm start

# OR for development with auto-reload:
npm run dev
```

You should see:
```
2025-10-12 13:16:06 info: TLS mapping loaded with 20 friendly names
2025-10-12 13:16:06 info: Cache service initialized
2025-10-12 13:16:06 info: SUMO subprocess service initialized
2025-10-12 13:16:06 info: 🚀 Three-Tier Architecture Server running on port 5001
2025-10-12 13:16:06 info: 📊 Environment: development
2025-10-12 13:16:06 info: 🔗 API Base URL: http://localhost:5001/api
2025-10-12 13:16:06 info: 💚 Health Check: http://localhost:5001/health
2025-10-12 13:16:06 info: 📖 API Info: http://localhost:5001/api
2025-10-12 13:16:06 info: 🔌 WebSocket: Real-time data streaming enabled
2025-10-12 13:16:06 info: ✅ Real-time data broadcasting started
2025-10-12 13:16:06 info: Connected to MongoDB
```

## Start the Frontend

In a **separate PowerShell window**:

```powershell
# Navigate to frontend directory
cd C:\GitHub\AddisAbaba\AddisAbabaSUMO\frontend

# Install dependencies (if not already done)
npm install

# Start the frontend
npm start
```

The frontend should open at `http://localhost:3000` and automatically connect to the backend at `http://localhost:5001`.

## Test the Integration

### 1. Health Check
```powershell
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-12T13:16:06.000Z",
  "uptime": 123.45,
  "mongodb": "connected",
  "redis": "connected",
  "cache": { ... }
}
```

### 2. API Info
```powershell
curl http://localhost:5001/api
```

This will show all available endpoints and confirm SUMO/TLS routes are mounted.

### 3. Test Login (from Frontend)
1. Open browser: `http://localhost:3000`
2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
   - **OR**
   - **Username**: `operator`
   - **Password**: `operator123`

### 4. Test SUMO Simulation
1. Navigate to the SUMO control page in the frontend
2. Click "Start Simulation"
3. Verify the simulation starts and status updates appear
4. Test traffic light (TLS) controls

### 5. Test Real-time Updates
1. Open the dashboard
2. Verify real-time data updates appear via Socket.IO
3. Check vehicle counts, speeds, etc. update automatically

## Verify All Features Work

### Frontend Checklist
- [ ] Login/logout works
- [ ] Dashboard shows real-time data
- [ ] User management (create/edit/delete users)
- [ ] Traffic data visualization
- [ ] SUMO simulation start/stop
- [ ] Traffic light (TLS) control
- [ ] Emergency vehicle handling
- [ ] Settings page works
- [ ] Audit logs visible
- [ ] Reports generation

## Common Issues

### Backend won't start - Port in use
```powershell
# Kill process using port 5001
Get-NetTCPConnection -LocalPort 5001 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### MongoDB connection error
Make sure MongoDB is running:
```powershell
# Check if MongoDB service is running
Get-Service -Name MongoDB

# Or start it
Start-Service -Name MongoDB

# Or run mongod directly
mongod
```

### Frontend can't connect to backend
1. Verify backend is running on port 5001
2. Check CORS settings allow `http://localhost:3000`
3. Check browser console for errors
4. Verify `backend/config.env` has correct settings

### SUMO won't start
1. Ensure `SUMO_HOME` environment variable is set:
   ```powershell
   $env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
   ```
2. Verify SUMO is installed and in PATH
3. Check `backend/sumo_bridge.py` exists
4. Verify config files exist in `frontend/public/Sumoconfigs/`

## Environment Variables

Create/verify `backend/config.env`:

```env
# Server
PORT=5001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/traffic_management

# Redis (optional)
REDIS_PORT=6379
REDIS_HOST=127.0.0.1

# JWT
ACCESS_TOKEN_SECRET=your-secret-key-here

# SUMO (adjust paths for your system)
SUMO_HOME=C:\Program Files (x86)\Eclipse\Sumo
SUMO_CONFIG_PATH=AddisAbabaSimple.sumocfg
```

## Next Steps

Once everything works:

1. **Remove the old server.js**:
   ```powershell
   mv backend\server.js backend\server.js.backup
   ```

2. **Update any scripts** that reference `server.js`

3. **Celebrate!** 🎉 You're now running a clean three-tier architecture!

## Architecture Overview

```
Frontend (React)
    ↓ HTTP/WebSocket
Backend (server-new.js)
    ├── Routes (Presentation Layer)
    ├── Controllers (Request Handlers)
    ├── Services (Business Logic)
    └── Repositories (Data Access)
         ↓
    MongoDB / Redis / SUMO
```

## Support

See `MIGRATION_COMPLETE.md` for detailed migration documentation.

For issues:
- Check console logs for errors
- Verify all services (MongoDB, Redis, SUMO) are running
- Check environment variables are set correctly
- Ensure dependencies are installed: `npm install`

---

**Server**: http://localhost:5001
**Frontend**: http://localhost:3000
**API Docs**: http://localhost:5001/api
