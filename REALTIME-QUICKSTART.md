# Real-Time Data - Quick Start Guide

## ⚡ TL;DR

Your traffic management system now has **real-time data updates** via WebSocket! 

## 🚀 Start Everything

```powershell
# Start MongoDB + Backend + Frontend
.\start-with-admin.ps1
```

## ✅ Test It

```powershell
# Run tests to verify everything works
.\test-realtime.ps1
```

## 🌐 Use It

1. Open http://localhost:3000
2. Login (admin/admin123 or operator/operator123)
3. Look for **🟢 green pulsing dots** = live data!

## 📊 What You Get

- **Live dashboard updates** every 3-5 seconds
- **Real-time traffic data** on map
- **SUMO simulation status** updates
- **System metrics** monitoring
- **Auto-reconnection** if connection drops
- **Fallback to HTTP** if WebSocket fails

## 🎯 Key Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green pulsing dot | Real-time data active |
| Green banner "Real-time data connected" | WebSocket connected |
| 🟡 Yellow "Connecting..." | Establishing connection |
| 🔴 Red "Connection unavailable" | WebSocket failed (using HTTP fallback) |
| Timestamp "Last update: XX:XX" | When data was last received |

## 📁 New Files Created

### Frontend
- `frontend/src/services/websocketService.js` - WebSocket manager
- `frontend/src/hooks/useRealTimeData.js` - React hooks for real-time data
- `frontend/src/components/RealTimeOperatorDashboard.js` - Live dashboard
- `frontend/src/components/RealTimeTrafficMap.js` - Live traffic map
- `frontend/src/components/RealTimeStatus.js` - Connection indicator

### Scripts
- `test-realtime.ps1` - Test real-time functionality
- `fix-mongodb-and-restart.ps1` - Fix MongoDB issues
- `start-with-admin.ps1` - Start all services

### Documentation
- `REALTIME-IMPLEMENTATION.md` - Complete implementation guide
- `REALTIME-QUICKSTART.md` - This file

## 🔧 Troubleshooting

### Nothing works?

```powershell
# Check if services are running
Get-Service MongoDB
Test-NetConnection localhost -Port 5001  # Backend
Test-NetConnection localhost -Port 3000  # Frontend
```

### MongoDB not running?

```powershell
# Fix MongoDB and restart backend
.\fix-mongodb-and-restart.ps1
```

### Still issues?

```powershell
# Run comprehensive tests
.\test-realtime.ps1
```

Check the output - it will tell you exactly what's wrong!

## 💡 Tips

1. **Open browser console (F12)** to see WebSocket connection logs
2. **Look for green pulsing dots** throughout the UI
3. **Connection status shows at top** of dashboard/map pages
4. **System falls back to HTTP** if WebSocket fails (no data loss!)
5. **Auto-reconnects** if connection drops

## 📖 Full Documentation

See `REALTIME-IMPLEMENTATION.md` for:
- Complete API reference
- Detailed configuration options
- Advanced troubleshooting
- Performance optimization tips
- Security considerations

## 🎉 That's It!

Your system now updates in real-time automatically. Enjoy! 🚀