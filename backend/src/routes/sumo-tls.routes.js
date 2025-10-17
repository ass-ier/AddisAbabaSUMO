/**
 * SUMO and TLS Routes
 * These routes handle complex SUMO subprocess management and TLS control
 * They require access to global state (sumoBridgeProcess, io, tlsMapping)
 * so they are passed as dependencies
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole, requireAnyRole } = require('../middleware/auth');
const auditService = require('../services/audit.service');
const settingsService = require('../services/settings.service');
const SimulationStatus = require('../models/SimulationStatus');
const Settings = require('../models/Settings');
const User = require('../models/User');
const logger = require('../utils/logger');
const sumoSubprocess = require('../services/sumo-subprocess.service');
const sumoLogsController = require('../controllers/sumo-logs.controller');

module.exports = function createSumoTlsRoutes(dependencies) {
  const router = express.Router();
  const { 
    sumoBridgeProcessRef, 
    io, 
    tlsMapping, 
    resolveTlsId, 
    resolveSumoConfigPath,
    DEFAULT_SUMO_CONFIG_DIR,
    ROOT_DIR,
    mapSettings
  } = dependencies;

  // Latest compact vehicles snapshot held in shared service
  const sumoState = require('../services/sumo-state.service');

  // Helper to send commands to SUMO bridge
  function sendBridgeCommand(obj) {
    logger.info('🚦 SENDING COMMAND:', obj);
    const result = sumoSubprocess.sendCommand(obj);
    if (result) {
      logger.info('✅ COMMAND SENT SUCCESSFULLY!');
    } else {
      logger.error('💥 FAILED TO SEND COMMAND');
    }
    return result;
  }

  // ===== Bridge health (additive) =====
  router.get('/bridge/health', async (req, res) => {
    try {
      const running = sumoSubprocess.getIsRunning();
      const proc = sumoSubprocess.getProcessInfo();
      res.json({
        ok: true,
        status: running ? 'running' : 'stopped',
        latest: sumoState.getLatestVehiclesSnapshot(),
        process: proc || null,
        serverTime: Date.now(),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Test frame injection for smoke tests (additive, no SUMO required)
  router.post('/bridge/test-frame', async (req, res) => {
    try {
      const { x = 0, y = 0, count = 8, spread = 5, speed = 2.0 } = req.body || {};
      const pts = [];
      for (let i = 0; i < Math.max(1, Math.min(100, Number(count) || 1)); i++) {
        const dx = (Math.random() - 0.5) * 2 * spread;
        const dy = (Math.random() - 0.5) * 2 * spread;
        pts.push({ id: `test_${i}`, x: x + dx, y: y + dy, speed });
      }
      const vizPayload = { type: 'viz', ts: Date.now(), step: -1, vehicles: pts, tls: [] };
      io.emit('viz', vizPayload);
      // Also compact
      const compact = { timestamp: vizPayload.ts, vehicles: pts.map(p => ({ id: p.id, x: p.x, y: p.y, speed: p.speed })) };
      sumoState.setLatestVehiclesSnapshot(compact);
      io.emit('vehicles', compact);
      res.json({ ok: true, sent: pts.length, center: { x, y } });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ===== TLS ROUTES =====
  
  // GET /api/tls/available - Get available TLS IDs
  router.get('/tls/available', authenticateToken, async (req, res) => {
    try {
      const friendlyNames = Object.keys(tlsMapping.mappings || {});
      const allTlsIds = tlsMapping.allTlsIds || [];
      const mappings = tlsMapping.mappings || {};
      const reverseMapping = tlsMapping.reverseMapping || {};
      
      res.json({
        friendlyNames,
        allTlsIds,
        mappings,
        reverseMapping,
        totalCount: allTlsIds.length,
        friendlyCount: friendlyNames.length
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get TLS data', error: error.message });
    }
  });

  // POST /api/tls/set-state - Set TLS state
  router.post('/tls/set-state', authenticateToken, async (req, res) => {
    try {
      if (!['super_admin', 'operator'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      if (!sumoBridgeProcessRef.process) {
        return res.status(409).json({ message: 'SUMO bridge is not running' });
      }
      
      const { tls_id, phase } = req.body || {};
      
      if (!tls_id || !phase) {
        return res.status(400).json({ message: 'tls_id and phase are required' });
      }
      
      const actualTlsId = resolveTlsId(tls_id);
      const cmd = { type: 'tls_state', id: actualTlsId, phase: phase };
      
      const ok = sendBridgeCommand(cmd);
      
      if (!ok) {
        return res.status(500).json({ message: 'Failed to send command to bridge' });
      }
      
      // Attach current simulationId for grouping logs by simulation
      let simId = null;
      try {
        const latest = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
        simId = latest?.simulationId || null;
      } catch (_) {}
      
      await auditService.record(req.user, 'tls_state_control', tls_id, { phase, actualTlsId, simulationId: simId, outcome: 'sent' });
      return res.json({ ok: true, tls_id, phase, actualTlsId, simulationId: simId });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // POST /api/tls/phase-control - TLS phase control
  router.post('/tls/phase-control', authenticateToken, async (req, res) => {
    try {
      if (!['super_admin', 'operator'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      
      if (!sumoBridgeProcessRef.process) {
        return res.status(409).json({ message: 'SUMO bridge is not running' });
      }
      
      const { tls_id, action, phaseIndex } = req.body || {};
      
      if (!tls_id || !action || !['next', 'prev', 'set', 'resume', 'reset'].includes(action)) {
        return res.status(400).json({ message: 'Invalid parameters' });
      }
      
      const actualTlsId = resolveTlsId(tls_id);
      const cmd = { type: 'tls', id: actualTlsId, cmd: action };
      
      if (action === 'set') {
        if (typeof phaseIndex !== 'number') {
          return res.status(400).json({ message: 'phaseIndex required for set' });
        }
        cmd.phaseIndex = phaseIndex;
      }
      
      const ok = sendBridgeCommand(cmd);
      
      if (!ok) {
        return res.status(500).json({ message: 'Failed to send command to bridge' });
      }
      
      // Attach current simulationId for grouping logs by simulation
      let simId = null;
      try {
        const latest = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
        simId = latest?.simulationId || null;
      } catch (_) {}
      
      await auditService.record(req.user, 'tls_phase_control', tls_id, { action, phaseIndex, actualTlsId, simulationId: simId, outcome: 'sent' });
      return res.json({ ok: true, tls_id, actualTlsId, action, phaseIndex, simulationId: simId });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // ===== SUMO ROUTES =====
  
  // GET /api/sumo/status - Get SUMO simulation status
  router.get('/sumo/status', authenticateToken, async (req, res) => {
    try {
      let status = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
      
      // Check if existing status is missing required fields - if so, create a new one
      if (!status || !status.name || !status.simulationId || !status.configuration?.networkFile || !status.configuration?.totalSteps) {
        if (status) {
          // Delete the invalid existing status
          await SimulationStatus.deleteOne({ _id: status._id });
        }
        
        status = new SimulationStatus({
          name: 'Default Simulation Status',
          isRunning: false,
          status: 'stopped',
          configuration: {
            networkFile: 'default.net.xml',
            totalSteps: 10800
          }
        });
        await status.save();
      } else {
        // Check actual process state and sync database status
        const actuallyRunning = sumoSubprocess.getIsRunning();
        const processInfo = sumoSubprocess.getProcessInfo();
        
        // If database says running but process is not running, update database
        if (status.isRunning && !actuallyRunning) {
          logger.info('SUMO process is not running but database says it is - updating status to stopped');
          status.isRunning = false;
          status.status = 'stopped';
          if (!status.endTime) {
            status.endTime = new Date();
          }
          status.lastUpdated = new Date();
          await status.save();
          
          // Clear process reference
          if (sumoBridgeProcessRef) {
            sumoBridgeProcessRef.process = null;
          }
        }
        // If database says stopped but process is running, update database
        else if (!status.isRunning && actuallyRunning) {
          logger.info('SUMO process is running but database says it is stopped - updating status to running');
          status.isRunning = true;
          status.status = 'running';
          if (!status.startTime) {
            status.startTime = new Date();
          }
          status.lastUpdated = new Date();
          await status.save();
        }
        
        // Add process info to response for debugging
        status = status.toJSON();
        status.processInfo = processInfo;
        status.actuallyRunning = actuallyRunning;
      }
      
      res.json(status);
    } catch (error) {
      res.status(500).json({
        message: 'Error getting simulation status',
        error: error.message
      });
    }
  });

  // GET /api/sumo/configs - List available SUMO configs
  router.get('/sumo/configs', authenticateToken, async (req, res) => {
    try {
      const dir = DEFAULT_SUMO_CONFIG_DIR;
      const files = fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.sumocfg'))
        .map(d => d.name)
        .sort();
      
      const s = await Settings.findOne();
      const selected = s?.sumo?.selectedConfig || null;
      
      res.json({ directory: dir, files, selected });
    } catch (e) {
      res.status(500).json({ message: 'Failed to list SUMO configs', error: e.message });
    }
  });

  // PUT /api/sumo/config - Set active SUMO config
  router.put('/sumo/config', authenticateToken, async (req, res) => {
    try {
      const { name } = req.body || {};
      logger.info('Setting SUMO config:', {
        requestedConfig: name,
        user: req.user?.username
      });
      
      if (!name || typeof name !== 'string' || !name.endsWith('.sumocfg')) {
        logger.error('Invalid config name provided:', name);
        return res.status(400).json({ message: 'Invalid config name' });
      }
      
      const fullPath = path.join(DEFAULT_SUMO_CONFIG_DIR, name);
      logger.info('Checking config file exists:', fullPath);
      
      if (!fs.existsSync(fullPath)) {
        logger.error('Config file not found:', fullPath);
        return res.status(404).json({ message: 'Config not found' });
      }
      
      logger.info('Saving SUMO config to database...');
      
      const s = await Settings.findOneAndUpdate(
        {},
        {
          $set: {
            'sumo.selectedConfig': name,
            'sumo.configDir': DEFAULT_SUMO_CONFIG_DIR,
            updatedAt: new Date()
          }
        },
        { new: true, upsert: true }
      );
      
      logger.info('SUMO config saved to database:', {
        savedConfig: s?.sumo?.selectedConfig,
        configDir: s?.sumo?.configDir,
        fullSumoSettings: s?.sumo
      });
      
      await auditService.record(req.user, 'set_sumo_config', name);
      res.json({ ok: true, selected: s?.sumo?.selectedConfig || name });
    } catch (e) {
      res.status(500).json({ message: 'Failed to set SUMO config', error: e.message });
    }
  });

  // POST /api/sumo/control - Control SUMO simulation
  router.post('/sumo/control', authenticateToken, async (req, res) => {
    try {
      logger.info('SUMO control request received', { command: req.body.command, user: req.user?.username });
      const { command, parameters = {} } = req.body;
      let status = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
      
      // Check if existing status is missing required fields - if so, create a new one
      if (!status || !status.name || !status.simulationId || !status.configuration?.networkFile || !status.configuration?.totalSteps) {
        if (status) {
          // Delete the invalid existing status
          await SimulationStatus.deleteOne({ _id: status._id });
        }
        
        status = new SimulationStatus({
          name: 'SUMO Control Session',
          isRunning: false,
          status: 'stopped',
          configuration: {
            networkFile: 'default.net.xml',
            totalSteps: 10800
          }
        });
      }

      switch (command) {
        case 'start_simulation':
          // Check if there's an orphaned process and clean it up
          const actuallyRunning = sumoSubprocess.getIsRunning();
          if (actuallyRunning) {
            logger.warn('Found orphaned SUMO process - killing it before starting new simulation');
            sumoSubprocess.kill('SIGTERM');
            // Wait a bit for process to die
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Check database status vs actual process state
          if (status.isRunning && !sumoSubprocess.getIsRunning()) {
            logger.info('Database shows running but no actual process - resetting status');
            status.isRunning = false;
            status.status = 'stopped';
            status.endTime = new Date();
            status.lastUpdated = new Date();
            await status.save();
          }
          
          if (status.isRunning) {
            return res.status(400).json({ message: 'Simulation is already running' });
          }

          // Determine SUMO config path based on scenario or fallback to database settings
          let selectedConfigName = null;
          let cfgPathEffective = null;
          
          // Check if scenario is provided in parameters for dynamic config selection
          const scenario = parameters.scenario;
          if (scenario) {
            // Map scenario to specific SUMO config file (fallback only)
            const scenarioConfigMap = {
              'default': 'AddisAbabaSimple.sumocfg',
              'rush_hour': 'AddisAbabaSimple_peak.sumocfg', 
              'night': 'AddisAbabaSimple_offpeak.sumocfg',
              'accident': 'AddisAbabaSimple_jitter.sumocfg'
            };

            // Prefer DB-selected config if available and valid; scenario mapping is only a fallback
            try {
              const s = await Settings.findOne();
              const dbSelected = s?.sumo?.selectedConfig || null;
              if (dbSelected) {
                const dbResolved = resolveSumoConfigPath(dbSelected);
                if (dbResolved && fs.existsSync(dbResolved)) {
                  selectedConfigName = dbSelected;
                  cfgPathEffective = dbResolved;
                  logger.info('Using DB-selected SUMO config:', { selectedConfig: selectedConfigName, resolvedPath: cfgPathEffective });
                }
              }
            } catch (e) {
              logger.warn('Failed to read DB-selected config, will try scenario mapping:', e.message);
            }

            if (!cfgPathEffective) {
              selectedConfigName = scenarioConfigMap[scenario] || scenarioConfigMap.default;
              const mapped = resolveSumoConfigPath(selectedConfigName);
              if (mapped && fs.existsSync(mapped)) {
                cfgPathEffective = mapped;
                logger.info('Using scenario-mapped SUMO config:', { scenario, selectedConfig: selectedConfigName, resolvedPath: cfgPathEffective });
              } else {
                logger.warn('Scenario-mapped config not found; will fall back to environment/default configuration', { scenario, selectedConfigName, mapped });
              }
            }
          } else {
            // Fallback to database settings or environment variable
            try {
              const s = await Settings.findOne();
              selectedConfigName = s?.sumo?.selectedConfig || null;
              logger.info('Retrieved SUMO config from database:', {
                selectedConfig: selectedConfigName,
                fullSettings: s?.sumo
              });
            } catch (err) {
              logger.error('Failed to retrieve SUMO config from database:', err.message);
            }
            cfgPathEffective = resolveSumoConfigPath(selectedConfigName || process.env.SUMO_CONFIG_PATH || '');
            logger.info('Resolved SUMO config path:', {
              selectedConfigName,
              envConfigPath: process.env.SUMO_CONFIG_PATH,
              finalPath: cfgPathEffective
            });
          }

          // Get settings for GUI and step length
          let startWithGui = false;
          let stepLength = 1.0;
          try {
            const settingsDoc = await Settings.findOne();
            if (settingsDoc?.sumo) {
              startWithGui = settingsDoc.sumo.startWithGui || false;
              stepLength = settingsDoc.sumo.stepLength || 1.0;
            }
            if (typeof parameters.startWithGui === 'boolean') {
              startWithGui = parameters.startWithGui;
            }
          } catch (e) {
            logger.warn('Failed to load settings for simulation start:', e.message);
          }

          // Generate simulation ID if not present
          if (!status.simulationId) {
            const timestamp = Date.now().toString().slice(-8);
            const random = Math.random().toString(36).substr(2, 4).toUpperCase();
            status.simulationId = `SIM-${timestamp}-${random}`;
          }
          
          // Set required fields
          status.name = status.name || `SUMO Simulation ${new Date().toLocaleString()}`;
          status.isRunning = true;
          status.status = 'starting';
          status.startTime = new Date();
          status.lastUpdated = new Date();
          
          // Set configuration fields
          if (!status.configuration) {
            status.configuration = {};
          }
          status.configuration.networkFile = status.configuration.networkFile || 'default.net.xml';
          status.configuration.totalSteps = 10800;
          status.configuration.currentStep = 0;
          status.configuration.stepLength = stepLength;
          status.configuration.guiEnabled = startWithGui;
          await status.save();

          io.emit('simulationStatus', status);
          io.emit('simulationLog', {
            level: 'info',
            message: `Starting SUMO simulation with config: ${cfgPathEffective}`,
            ts: Date.now()
          });
          
          // Spawn SUMO subprocess
          try {
            const spawnResult = sumoSubprocess.spawn({
              cfgPath: cfgPathEffective,
              startWithGui,
              stepLength,
              rlOptions: parameters.useRL ? {
                modelPath: parameters.rlModelPath,
                delta: parameters.rlDelta || 15
              } : null,
              onData: (payload) => {
                // Handle SUMO output data
                if (payload.type === 'viz') {
                  io.emit('sumoData', payload);
                  // Also emit compact vehicles frame for heatmap consumers (additive)
                  try {
                    const compact = {
                      timestamp: payload.ts || Date.now(),
                      vehicles: Array.isArray(payload.vehicles)
                        ? payload.vehicles.map(v => ({
                            id: v.id,
                            x: typeof v.x === 'number' ? v.x : undefined,
                            y: typeof v.y === 'number' ? v.y : undefined,
                            speed: typeof v.speed === 'number' ? v.speed : undefined,
                          }))
                        : [],
                    };
                    sumoState.setLatestVehiclesSnapshot(compact);
                    io.emit('vehicles', compact);
                  } catch (_) {}
                  
                  // Update simulation step
                  if (payload.step) {
                    status.configuration.currentStep = payload.step;
                    status.lastUpdated = new Date();
                    status.save().catch(() => {});
                  }
                } else if (payload.type === 'log') {
                  io.emit('simulationLog', {
                    level: payload.level || 'info',
                    message: payload.message,
                    ts: Date.now()
                  });
                } else if (payload.type === 'net') {
                  io.emit('sumoNet', payload);
                } else if (payload.type === 'route') {
                  // Relay emergency vehicle route to clients
                  io.emit('emergencyRoutes', payload);
                } else if (payload.type === 'error') {
                  const stackInfo = payload.stack ? `\nStack: ${payload.stack}` : '';
                  logger.error(`SUMO error: ${payload.message}${stackInfo}`);
                  io.emit('simulationLog', {
                    level: 'error',
                    message: payload.stack ? `${payload.message} | ${payload.stack}` : payload.message,
                    ts: Date.now()
                  });
                }
              },
              onError: async (err) => {
                logger.error(`SUMO subprocess error: ${err.message}`);
                io.emit('simulationLog', {
                  level: 'error',
                  message: `SUMO subprocess error: ${err.message}`,
                  ts: Date.now()
                });
                
                // Update status to reflect error
                status.isRunning = false;
                status.status = 'error';
                status.endTime = new Date();
                status.lastUpdated = new Date();
                
                try {
                  await status.save();
                  io.emit('simulationStatus', status);
                  logger.info('Status updated to error in database');
                } catch (saveError) {
                  logger.error(`Failed to save error status: ${saveError.message}`);
                }
                
                // Clear process reference
                sumoBridgeProcessRef.process = null;
              },
              onExit: async (code, signal) => {
                logger.info(`SUMO subprocess exited with code ${code}, signal ${signal}`);
                io.emit('simulationLog', {
                  level: 'info',
                  message: `SUMO simulation ended (code: ${code}, signal: ${signal})`,
                  ts: Date.now()
                });
                
                // Update status based on exit code and signal
                status.isRunning = false;
                // If terminated by signal (like SIGTERM), it's stopped, not completed
                if (signal) {
                  status.status = 'stopped';
                } else {
                  // Natural exit: completed if success (code 0), error if failed
                  status.status = (code === 0) ? 'completed' : 'error';
                }
                status.endTime = new Date();
                status.lastUpdated = new Date();
                
                try {
                  await status.save();
                  io.emit('simulationStatus', status);
                  logger.info(`Status updated to ${status.status} in database`);
                } catch (saveError) {
                  logger.error(`Failed to save exit status: ${saveError.message}`);
                }
                
                // Clear process reference
                sumoBridgeProcessRef.process = null;
              }
            });

            // Store process reference for TLS commands
            sumoBridgeProcessRef.process = sumoSubprocess.process;

            io.emit('simulationLog', {
              level: 'info',
              message: `SUMO bridge started with PID ${spawnResult.pid}`,
              ts: Date.now()
            });

            logger.info(`SUMO simulation started successfully (PID: ${spawnResult.pid})`);
          } catch (spawnError) {
            logger.error(`Failed to spawn SUMO subprocess: ${spawnError.message}`);
            
            status.isRunning = false;
            status.status = 'error';
            status.endTime = new Date();
            status.lastUpdated = new Date();
            await status.save();
            io.emit('simulationStatus', status);
            io.emit('simulationLog', {
              level: 'error',
              message: `Failed to start SUMO: ${spawnError.message}`,
              ts: Date.now()
            });

            return res.status(500).json({
              status: 'error',
              message: 'Failed to start SUMO simulation',
              error: spawnError.message
            });
          }

          await auditService.record(req.user, 'start_simulation', 'sumo', parameters);
          res.json({
            status: 'success',
            message: 'Simulation started successfully',
            data: status
          });
          break;

        case 'stop_simulation':
          // Check if simulation is actually running
          const processRunning = sumoSubprocess.getIsRunning();
          if (!status.isRunning && !processRunning) {
            return res.status(400).json({ message: 'No simulation is currently running' });
          }

          // Kill SUMO subprocess if it's running
          if (processRunning) {
            sumoSubprocess.kill('SIGTERM');
          }
          sumoBridgeProcessRef.process = null;

          // Update status
          status.isRunning = false;
          status.status = 'stopped';
          status.endTime = new Date();
          status.lastUpdated = new Date();
          await status.save();

          io.emit('simulationStatus', status);
          io.emit('simulationLog', {
            level: 'info',
            message: 'Simulation stopped by user',
            ts: Date.now()
          });

          await auditService.record(req.user, 'stop_simulation', 'sumo');
          res.json({
            status: 'success',
            message: 'Simulation stopped successfully',
            data: status
          });
          break;

        case 'pause_simulation':
          if (!status.isRunning) {
            return res.status(400).json({ message: 'No simulation is currently running' });
          }

          status.isRunning = false;
          status.status = 'paused';
          status.pausedTime = new Date();
          status.lastUpdated = new Date();
          await status.save();

          io.emit('simulationStatus', status);

          await auditService.record(req.user, 'pause_simulation', 'sumo');
          res.json({
            status: 'success',
            message: 'Simulation paused successfully',
            data: status
          });
          break;

        case 'resume_simulation':
          if (status.isRunning) {
            return res.status(400).json({ message: 'Simulation is already running' });
          }

          status.isRunning = true;
          status.status = 'running';
          status.pausedTime = null;
          status.lastUpdated = new Date();
          await status.save();

          io.emit('simulationStatus', status);

          await auditService.record(req.user, 'resume_simulation', 'sumo');
          res.json({
            status: 'success',
            message: 'Simulation resumed successfully',
            data: status
          });
          break;

        default:
          res.status(400).json({ message: 'Invalid command' });
      }
    } catch (error) {
      logger.error('SUMO control error:', { 
        error: error.message, 
        stack: error.stack, 
        command: req.body?.command,
        user: req.user?.username 
      });
      res.status(500).json({ message: 'SUMO command error', error: error.message });
    }
  });

  // GET /api/map/settings - Get map settings
  router.get('/map/settings', authenticateToken, async (req, res) => {
    try {
      res.json(mapSettings);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // PUT /api/map/settings - Update map settings
  router.put('/map/settings', authenticateToken, async (req, res) => {
    try {
      const body = req.body || {};
      if (body.mode && ['simulation', 'real'].includes(body.mode)) {
        mapSettings.mode = body.mode;
      }
      if (
        body.bbox &&
        typeof body.bbox.minLat === 'number' &&
        typeof body.bbox.minLon === 'number' &&
        typeof body.bbox.maxLat === 'number' &&
        typeof body.bbox.maxLon === 'number'
      ) {
        mapSettings.bbox = { ...body.bbox };
      }
      res.json(mapSettings);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // GET /api/users/count - Get user count (super_admin)
  router.get('/users/count', authenticateToken, requireRole('super_admin'), async (req, res) => {
    try {
      const count = await User.countDocuments({});
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: 'Failed to count users', error: error.message });
    }
  });

  // POST /api/sumo/open-gui - Open SUMO GUI application
  router.post('/sumo/open-gui', authenticateToken, requireAnyRole(['super_admin']), async (req, res) => {
    try {
      const startWithCfg = req.body?.withConfig !== false; // default true
      
      // Resolve config from settings
      let selectedConfigName = null;
      try {
        const s = await Settings.findOne();
        selectedConfigName = s?.sumo?.selectedConfig || null;
      } catch (_) {}
      
      const cfgPath = resolveSumoConfigPath(selectedConfigName || process.env.SUMO_CONFIG_PATH || '');
      const guiBinary = process.env.SUMO_BINARY_GUI_PATH || 
                        (process.platform === 'win32' ? 'sumo-gui.exe' : 'sumo-gui');
      
      const args = [];
      if (startWithCfg && cfgPath) {
        args.push('-c', cfgPath);
      }
      
      const child = spawn(guiBinary, args, { detached: true, stdio: 'ignore' });
      child.unref();
      
      await auditService.record(req.user, 'open_sumo_gui', guiBinary, { args });
      logger.info(`SUMO GUI opened: ${guiBinary} ${args.join(' ')}`);
      
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to open SUMO GUI', error: error.message });
    }
  });

  // GET /api/sumo/scenario-config/:scenarioId - Get scenario configuration
  router.get('/sumo/scenario-config/:scenarioId', authenticateToken, async (req, res) => {
    try {
      const { scenarioId } = req.params;
      
      if (!scenarioId || typeof scenarioId !== 'string') {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Invalid scenario ID' 
        });
      }

      // Get configuration from settings
      const settings = await Settings.findOne();
      const scenarioConfigs = settings?.sumo?.scenarioConfigs || {};
      const config = scenarioConfigs[scenarioId];

      if (config) {
        res.json({
          status: 'success',
          data: config
        });
      } else {
        res.json({
          status: 'not_found',
          message: 'No saved configuration found for this scenario'
        });
      }
    } catch (error) {
      logger.error('Error getting scenario config:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get scenario configuration',
        error: error.message
      });
    }
  });

  // PUT /api/sumo/scenario-config - Save scenario configuration
  router.put('/sumo/scenario-config', authenticateToken, async (req, res) => {
    try {
      const { scenario, config } = req.body;
      
      if (!scenario || !config || typeof scenario !== 'string') {
        return res.status(400).json({
          status: 'error',
          message: 'Scenario name and config are required'
        });
      }

      // Validate config structure (basic validation)
      const requiredFields = ['stepLength', 'maxSpeed', 'minGap', 'accel', 'decel', 'sigma'];
      const missingFields = requiredFields.filter(field => !(field in config));
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Missing required config fields: ${missingFields.join(', ')}`
        });
      }

      // Update settings with scenario configuration
      const updatePath = `sumo.scenarioConfigs.${scenario}`;
      const updateObj = {
        [updatePath]: {
          ...config,
          lastUpdated: new Date()
        },
        updatedAt: new Date()
      };

      await Settings.findOneAndUpdate(
        {},
        { $set: updateObj },
        { new: true, upsert: true }
      );

      await auditService.record(req.user, 'save_scenario_config', scenario, { config });
      logger.info(`Scenario configuration saved: ${scenario}`);

      res.json({
        status: 'success',
        message: 'Configuration saved successfully'
      });
    } catch (error) {
      logger.error('Error saving scenario config:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to save scenario configuration',
        error: error.message
      });
    }
  });

  // GET /api/sumo/scenarios - Get all available scenarios
  router.get('/sumo/scenarios', authenticateToken, async (req, res) => {
    try {
      const scenarios = [
        {
          id: 'default',
          name: 'Default Scenario',
          description: 'Standard traffic simulation'
        },
        {
          id: 'rush_hour',
          name: 'Rush Hour',
          description: 'High density traffic simulation'
        },
        {
          id: 'night',
          name: 'Night Traffic',
          description: 'Low density night simulation'
        },
        {
          id: 'accident',
          name: 'Accident Scenario',
          description: 'Traffic simulation with accident monitoring'
        }
      ];

      // Get saved configurations from settings
      const settings = await Settings.findOne();
      const scenarioConfigs = settings?.sumo?.scenarioConfigs || {};

      // Add configuration status to each scenario
      const scenariosWithStatus = scenarios.map(scenario => ({
        ...scenario,
        hasConfiguration: !!scenarioConfigs[scenario.id],
        lastUpdated: scenarioConfigs[scenario.id]?.lastUpdated || null
      }));

      res.json({
        status: 'success',
        data: scenariosWithStatus
      });
    } catch (error) {
      logger.error('Error getting scenarios:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get scenarios',
        error: error.message
      });
    }
  });

  // ===== SUMO LOGS ROUTES =====
  
  // GET /api/sumo/logs - Get SUMO logs
  router.get('/sumo/logs', authenticateToken, sumoLogsController.getLogs.bind(sumoLogsController));
  
  // POST /api/sumo/logs - Create SUMO log entry
  router.post('/sumo/logs', authenticateToken, sumoLogsController.createLog.bind(sumoLogsController));
  
  // DELETE /api/sumo/logs - Clear SUMO logs
  router.delete('/sumo/logs', authenticateToken, sumoLogsController.clearLogs.bind(sumoLogsController));
  
  // GET /api/sumo/logs/stats - Get SUMO log statistics
  router.get('/sumo/logs/stats', authenticateToken, sumoLogsController.getLogStats.bind(sumoLogsController));
  
  // POST /api/sumo/logs/bulk - Bulk create SUMO logs (admin only)
  router.post('/sumo/logs/bulk', authenticateToken, requireAnyRole(['super_admin', 'admin']), sumoLogsController.bulkCreateLogs.bind(sumoLogsController));

  return router;
};
