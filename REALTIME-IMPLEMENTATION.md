# Real-Time Data Implementation Guide

## Overview

Your AddisAbaba SUMO Traffic Management System now features comprehensive real-time data capabilities using WebSocket (Socket.IO) technology. This enables live updates of traffic data, simulation status, and system metrics without requiring manual page refreshes.

## 🚀 Quick Start

### 1. Start All Services

```powershell
# Option 1: Use the all-in-one startup script
.\start-with-admin.ps1

# Option 2: Start services individually
# Start MongoDB (requires admin privileges)
Start-Service MongoDB

# Start Backend (in separate terminal)
cd backend
npm run dev

# Start Frontend (in separate terminal)  
cd frontend
npm start
```

### 2. Test Real-Time Functionality

```powershell
# Run the comprehensive test suite
.\test-realtime.ps1
```

### 3. Access the Application

- Open browser to: http://localhost:3000
- Login with credentials
- Look for **green pulsing indicators** showing live data
- Check the **connection status banner** at the top of pages

## 📁 File Structure

### Frontend Components

```
frontend/src/
├── services/
│   └── websocketService.js         # Core WebSocket connection manager
├── hooks/
│   └── useRealTimeData.js          # React hooks for real-time data
├── components/
│   ├── RealTimeOperatorDashboard.js    # Enhanced dashboard with live data
│   ├── RealTimeTrafficMap.js           # Live traffic map component
│   ├── RealTimeStatus.js               # Connection status indicator
│   └── Dashboard.js                    # Updated to use real-time version
```

### Backend Services

```
backend/src/services/
└── websocket.service.js            # Backend WebSocket broadcasting service
```

### Scripts

```
├── test-realtime.ps1               # Test real-time functionality
├── fix-mongodb-and-restart.ps1     # Fix MongoDB and restart backend
└── start-with-admin.ps1            # Start all services with proper setup
```

## 🔧 Implementation Details

### WebSocket Service (`websocketService.js`)

**Key Features:**
- Auto-connection with retry logic (up to 10 attempts)
- Exponential backoff for reconnection attempts
- Heartbeat monitoring for connection health
- Authentication and subscription management
- Event-driven architecture with custom listeners

**Connection URL:**
```javascript
const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5001';
```

**Available Data Streams:**
- `dashboard` - Dashboard metrics (5s interval)
- `traffic` - Traffic data (3s interval)
- `sumo` - SUMO simulation status (2s interval)
- `system` - System metrics (10s interval)
- `alerts` - Alert notifications (15s interval)

### React Hooks (`useRealTimeData.js`)

**Specialized Hooks:**

```javascript
// General purpose hook
const { data, connected, connecting, error } = useRealTimeData(['dashboard', 'traffic']);

// Specialized hooks for specific data types
const { dashboardData, trafficData, sumoStatus } = useDashboardData();
const { systemMetrics } = useSystemMetrics();
const { trafficData } = useTrafficData();
const { alerts } = useAlerts();
const { sumoStatus } = useSumoStatus();
```

**Hook Features:**
- Automatic connection management
- Auto-cleanup on component unmount
- Automatic authentication with user context
- Dynamic subscription management
- Fallback support for when WebSocket fails

### Enhanced Components

#### RealTimeOperatorDashboard

**Features:**
- Live connection status banner with color-coded indicators
- Animated pulsing dots for real-time data
- Automatic data updates from WebSocket streams
- HTTP fallback when WebSocket unavailable
- Last update timestamps
- Retry connection button

**Visual Indicators:**
- 🟢 Green banner: Real-time connected
- 🟡 Yellow banner: Connecting...
- 🔴 Red banner: Connection unavailable (with retry button)
- Green pulsing dots: Live data indicators

#### RealTimeTrafficMap

**Features:**
- Live traffic point updates with animated circles
- Real-time vehicle counts and average speeds
- Dynamic circle colors based on congestion levels
- Connection status integration
- Auto-updating statistics panels

**Map Indicators:**
- Circle color: Green (normal), Orange (moderate), Red (congested)
- Circle size: Proportional to vehicle count
- Pulsing animation when connected

## 📊 Real-Time Data Flow

```
Backend (Socket.IO Server)
    ↓
[Broadcasting Service]
    ├── Dashboard Data (every 5s)
    ├── Traffic Data (every 3s)
    ├── SUMO Status (every 2s)
    ├── System Metrics (every 10s)
    └── Alerts (every 15s)
    ↓
WebSocket Connection
    ↓
Frontend (Socket.IO Client)
    ├── websocketService.js (Connection Manager)
    ↓
    ├── useRealTimeData Hook (State Manager)
    ↓
    └── React Components (UI Updates)
        ├── RealTimeOperatorDashboard
        ├── RealTimeTrafficMap
        └── RealTimeStatus
```

## 🔐 Connection Management

### Authentication Flow

1. Component mounts and triggers `useRealTimeData` hook
2. Hook calls `websocketService.connect()`
3. WebSocket establishes connection to backend
4. Backend sends `connected` event with available streams
5. Frontend sends authentication with user credentials
6. Backend validates and sends `authenticated` event
7. Frontend subscribes to required data streams
8. Backend sends `subscribed` confirmation
9. Real-time data begins flowing

### Reconnection Strategy

```javascript
// Exponential backoff
Attempt 1: 1 second delay
Attempt 2: 2 seconds delay
Attempt 3: 4 seconds delay
Attempt 4: 8 seconds delay
...up to 10 attempts
```

### Heartbeat Monitoring

- **Ping interval**: Every 30 seconds
- **Pong timeout**: 10 seconds
- **Action on failure**: Trigger reconnection

## 🎨 UI/UX Features

### Connection Status Indicators

**Location**: Top of dashboard and map pages

**States:**
- **Connected** (Green): "Real-time data connected" with timestamp
- **Connecting** (Yellow): "Connecting to real-time data..."
- **Disconnected** (Red): "Real-time connection unavailable" with retry button

### Live Data Indicators

**Visual Elements:**
- Small green pulsing dots next to metrics
- "Real-time" badges on data cards
- "Live monitoring" labels
- Timestamp of last update

### Fallback Behavior

When WebSocket connection fails:
1. System automatically falls back to HTTP requests
2. Visual indicators show non-real-time state
3. User can manually retry connection
4. Data continues to load (just not in real-time)

## 🧪 Testing

### Run Complete Test Suite

```powershell
.\test-realtime.ps1
```

**Tests Performed:**
1. MongoDB service status
2. Backend server connectivity
3. Socket.IO endpoint availability
4. Frontend server accessibility
5. API endpoint validation
6. Real-time service file existence
7. Network connectivity to required ports

### Manual Testing

1. **Connection Test:**
   - Open browser developer console (F12)
   - Look for "✅ WebSocket connected" logs
   - Check for "Successfully subscribed to streams" messages

2. **Data Flow Test:**
   - Watch for data update logs in console
   - Observe green pulsing indicators on dashboard
   - Check timestamps updating in real-time

3. **Reconnection Test:**
   - Stop backend server
   - Observe red connection banner
   - Restart backend server
   - Should auto-reconnect and show green banner

## 🛠️ Configuration

### Environment Variables

Create `.env` file in frontend directory:

```env
REACT_APP_SERVER_URL=http://localhost:5001
```

### Backend Configuration

In `backend/src/services/websocket.service.js`:

```javascript
// Adjust update intervals
this.dataIntervals.set('dashboard', setInterval(async () => {
  await this.broadcastDashboardData();
}, 5000)); // Change interval here
```

### CORS Configuration

Backend already configured for:
```javascript
cors: {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST"],
  credentials: true
}
```

## 🐛 Troubleshooting

### Connection Issues

**Problem:** "Real-time connection unavailable"

**Solutions:**
1. Ensure MongoDB is running: `Get-Service MongoDB`
2. Check backend is running on port 5001
3. Check frontend is running on port 3000
4. Verify no firewall blocking ports
5. Check browser console for specific errors

### No Data Updates

**Problem:** Connected but no data flowing

**Solutions:**
1. Check backend console for broadcasting logs
2. Verify subscriptions in browser console
3. Check if SUMO simulation is running
4. Restart backend service

### Performance Issues

**Problem:** Slow updates or lag

**Solutions:**
1. Reduce update intervals in backend
2. Check system resources (CPU, memory)
3. Limit number of active connections
4. Check network bandwidth

## 📈 Performance Optimization

### Frontend

- Components only re-render when subscribed data changes
- Automatic cleanup prevents memory leaks
- Connection shared across components (singleton pattern)
- Debounced updates for rapid data changes

### Backend

- Only broadcasts when clients connected
- Filtered broadcasting based on subscriptions
- Error handling prevents crashes
- Efficient data querying with proper indexes

## 🔒 Security Considerations

### Authentication

- User authentication required before data streaming
- Token validation on every connection
- Automatic disconnection on auth failure

### Data Validation

- Input validation on subscriptions
- Sanitized data before broadcasting
- Rate limiting on connections

## 📚 API Reference

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticate` | `{ user }` | Authenticate connection |
| `subscribe` | `{ streams: [] }` | Subscribe to data streams |
| `unsubscribe` | `{ streams: [] }` | Unsubscribe from streams |
| `ping` | - | Heartbeat check |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ clientId, serverTime, availableStreams }` | Connection confirmed |
| `authenticated` | `{ success, user }` | Auth result |
| `subscribed` | `{ streams, message }` | Subscription confirmed |
| `dashboard` | `{ ...metrics }` | Dashboard data |
| `trafficData` | `{ overview, stats }` | Traffic data |
| `sumoStatus` | `{ isRunning, processInfo }` | SUMO status |
| `systemMetrics` | `{ metrics, health }` | System metrics |
| `alerts` | `[ ...alerts ]` | Alert notifications |
| `pong` | `{ timestamp }` | Heartbeat response |

## 🎯 Next Steps

### Enhancements to Consider

1. **Historical Data Charts**: Add real-time updating charts
2. **Map Overlays**: Show real-time traffic flow on map
3. **Push Notifications**: Browser notifications for alerts
4. **Mobile Support**: Optimize for mobile devices
5. **Data Export**: Export real-time data to CSV/JSON
6. **Advanced Filtering**: Filter real-time data streams
7. **User Preferences**: Save preferred update intervals

### Production Deployment

1. **Use WSS (WebSocket Secure)** for HTTPS sites
2. **Configure load balancing** for multiple servers
3. **Implement Redis adapter** for Socket.IO scaling
4. **Set up monitoring** for connection metrics
5. **Configure CDN** for static assets
6. **Enable compression** for WebSocket messages

## 📞 Support

For issues or questions:
1. Check browser console for error messages
2. Run `.\test-realtime.ps1` for diagnostics
3. Review backend logs for server-side issues
4. Check MongoDB connection status

## ✅ Checklist

Before using real-time features:

- [ ] MongoDB service is running
- [ ] Backend server is running on port 5001
- [ ] Frontend server is running on port 3000
- [ ] No firewall blocking ports 3000, 5001, 27017
- [ ] Browser supports WebSocket (all modern browsers do)
- [ ] User is logged in with valid credentials

---

**Implementation Complete!** 🎉

Your traffic management system now has full real-time capabilities with automatic updates, visual indicators, and robust connection management.