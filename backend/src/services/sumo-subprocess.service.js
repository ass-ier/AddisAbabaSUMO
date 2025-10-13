const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * SUMO Subprocess Service
 * Manages the spawning and lifecycle of the SUMO Python bridge process
 */
class SumoSubprocessService {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.buffer = '';
    this.lastStepLog = 0;
    this.processRef = null; // Reference to shared process object
    this.io = null; // Socket.IO instance
  }

  /**
   * Initialize the service with shared references
   * @param {Object} processRef - Shared process reference object
   * @param {Object} io - Socket.IO instance
   */
  init(processRef, io) {
    this.processRef = processRef;
    this.io = io;
    logger.info('SUMO subprocess service initialized');
  }

  /**
   * Select the best available Python executable
   */
  selectPythonCommand() {
    const candidates = [];
    if (process.env.PYTHON_EXE) candidates.push(process.env.PYTHON_EXE);
    if (process.platform === 'win32') candidates.push('py');
    candidates.push('python', 'python3');

    for (const cmd of candidates) {
      if (!cmd) continue;
      if (cmd.includes(':') || cmd.includes('/') || cmd.includes('\\')) {
        if (fs.existsSync(cmd)) return cmd;
        continue;
      }
      return cmd;
    }
    return 'python';
  }

  /**
   * Resolve the SUMO binary path based on settings and environment
   */
  resolveSumoBinary(selectedPath, wantGui) {
    const isAbsolute = selectedPath && (
      selectedPath.includes(':') || 
      selectedPath.includes('/') || 
      selectedPath.includes('\\')
    );

    if (isAbsolute && fs.existsSync(selectedPath)) {
      return selectedPath;
    }

    // Try SUMO_HOME/bin
    if (process.env.SUMO_HOME) {
      const binName = process.platform === 'win32'
        ? (wantGui ? 'sumo-gui.exe' : 'sumo.exe')
        : (wantGui ? 'sumo-gui' : 'sumo');
      const bin = path.join(process.env.SUMO_HOME, 'bin', binName);
      if (fs.existsSync(bin)) return bin;
    }

    // Fallback to name on PATH
    return wantGui
      ? (process.platform === 'win32' ? 'sumo-gui.exe' : 'sumo-gui')
      : (process.platform === 'win32' ? 'sumo.exe' : 'sumo');
  }

  /**
   * Spawn the SUMO Python bridge process
   * @param {Object} options - Spawn options
   * @param {string} options.cfgPath - Path to SUMO config file
   * @param {boolean} options.startWithGui - Whether to start with GUI
   * @param {number} options.stepLength - Simulation step length
   * @param {Object} options.rlOptions - Optional RL control options
   * @param {Function} options.onData - Callback for stdout data (JSON lines)
   * @param {Function} options.onError - Callback for errors
   * @param {Function} options.onExit - Callback for process exit
   * @returns {Object} Spawn result with process info
   */
  spawn(options) {
    const {
      cfgPath,
      startWithGui = false,
      stepLength = 1.0,
      rlOptions = null,
      onData = () => {},
      onError = () => {},
      onExit = () => {}
    } = options;

    try {
      // Validate config file exists
      if (!fs.existsSync(cfgPath)) {
        throw new Error(`SUMO config not found: ${cfgPath}`);
      }

      // Select Python executable
      const pythonExe = this.selectPythonCommand();
      const bridgePath = path.join(__dirname, '../../sumo_bridge.py');

      if (!fs.existsSync(bridgePath)) {
        throw new Error(`SUMO bridge script not found: ${bridgePath}`);
      }

      // Resolve SUMO binary
      const sumoBinary = this.resolveSumoBinary(
        startWithGui ? process.env.SUMO_BINARY_GUI_PATH : process.env.SUMO_BINARY_PATH,
        startWithGui
      );

      // Validate SUMO binary if absolute path
      if ((sumoBinary.includes(':') || sumoBinary.includes('/') || sumoBinary.includes('\\')) 
          && !fs.existsSync(sumoBinary)) {
        throw new Error(`SUMO binary not found: ${sumoBinary}`);
      }

      // Build environment
      const env = { ...process.env };
      env.PYTHONIOENCODING = env.PYTHONIOENCODING || 'utf-8';

      if (process.env.SUMO_HOME) {
        env.PYTHONPATH = [
          env.PYTHONPATH || '',
          path.join(process.env.SUMO_HOME, 'tools')
        ].filter(Boolean).join(path.delimiter);

        const sumoBin = path.join(process.env.SUMO_HOME, 'bin');
        env.PATH = [sumoBin, env.PATH || process.env.PATH || '']
          .filter(Boolean)
          .join(path.delimiter);
      }

      // Build arguments
      const args = [
        bridgePath,
        '--sumo-bin', sumoBinary,
        '--sumo-cfg', cfgPath,
        '--step-length', String(stepLength)
      ];

      // Add RL options if requested
      if (rlOptions) {
        const ROOT_DIR = path.join(__dirname, '../../../');
        // Allow overriding model path via env if not provided by caller
        let rlModelPath = rlOptions.modelPath || process.env.RL_MODEL_PATH || '';

        if (rlModelPath) {
          if (!path.isAbsolute(rlModelPath)) {
            const defaultPublic = path.join(ROOT_DIR, 'frontend', 'public', 'Sumoconfigs', 'logs', 'best_model.zip');
            if (fs.existsSync(defaultPublic)) {
              rlModelPath = defaultPublic;
            } else {
              rlModelPath = path.join(ROOT_DIR, rlModelPath);
            }
          }
        } else {
          // No model specified; try well-known default in project tree
          const candidates = [
            path.join(ROOT_DIR, 'frontend', 'public', 'Sumoconfigs', 'logs', 'best_model.zip'),
            path.join(ROOT_DIR, 'Sumoconfigs', 'logs', 'best_model.zip')
          ];
          rlModelPath = candidates.find(p => fs.existsSync(p)) || '';
        }

        if (!rlModelPath || !fs.existsSync(rlModelPath)) {
          // Fail fast instead of silently falling back to fixed logic
          throw new Error('RL requested but model file not found. Provide a valid RL model path or set RL_MODEL_PATH.');
        }

        args.push('--rl-model', rlModelPath);
        args.push('--rl-delta', String(rlOptions.delta || 15));
        if (startWithGui) args.push('--rl-use-gui');
        logger.info(`RL control enabled with model ${rlModelPath}`);
      }

      // Spawn the process
      logger.info(`Spawning SUMO bridge: ${pythonExe} ${args.join(' ')}`);
      this.process = spawn(pythonExe, args, { env });
      this.isRunning = true;
      
      // Update shared reference if available
      if (this.processRef) {
        this.processRef.process = this.process;
      }

      if (this.process.pid) {
        logger.info(`SUMO bridge started with PID: ${this.process.pid}`);
      }

      // Handle process error
      this.process.on('error', (err) => {
        const msg = err?.message || String(err);
        logger.error(`SUMO bridge spawn error: ${msg}`);
        this.isRunning = false;
        onError(err);
      });

      // Handle stdout (JSON lines)
      this.process.stdout.on('data', (chunk) => {
        this.buffer += chunk.toString();
        let index;
        while ((index = this.buffer.indexOf('\n')) >= 0) {
          const line = this.buffer.slice(0, index).trim();
          this.buffer = this.buffer.slice(index + 1);
          if (!line) continue;

          try {
            const payload = JSON.parse(line);
            onData(payload);
            
            // Log step progress periodically
            if (payload.type === 'viz' && payload.step) {
              const now = Date.now();
              if (now - this.lastStepLog > 5000) { // Log every 5 seconds
                logger.info(`SUMO simulation step: ${payload.step}`);
                this.lastStepLog = now;
              }
            }
          } catch (e) {
            logger.warn(`Failed to parse SUMO output: ${line}`);
          }
        }
      });

      // Handle stderr with memory allocation detection
      this.process.stderr.on('data', (chunk) => {
        const msg = chunk.toString();

        // Best Practice: Detect memory allocation errors and provide helpful guidance
        if (msg.includes('bad allocation') || msg.includes('std::bad_alloc')) {
          logger.error('SUMO MEMORY ERROR: Network file too large for available memory');
          logger.warn('RECOMMENDATION: Use a smaller network file or increase system memory');
          logger.warn('System will continue running without SUMO simulation');

          // Emit warning to connected clients
          if (this.io) {
            this.io.emit('sumo:warning', {
              type: 'memory_error',
              message: 'Network file too large. System running without SUMO simulation.',
              recommendation: 'Consider using a smaller network subset'
            });
          }
        } else {
          logger.error(`SUMO bridge stderr: ${msg}`);
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        const exitMsg = `SUMO bridge exited with code ${code}, signal ${signal}`;

        // Best Practice: Different log levels based on exit code
        if (code === 1 && signal === null) {
          // Exit code 1 often means configuration/memory error
          logger.warn(`${exitMsg} - Likely due to network file size or configuration issue`);
          logger.info('APPLICATION CONTINUES: All other features remain functional');
        } else if (code === 0) {
          logger.info(`${exitMsg} - Clean shutdown`);
        } else {
          logger.error(`${exitMsg} - Unexpected exit`);
        }

        this.isRunning = false;
        this.process = null;
        
        // Clear shared reference if available
        if (this.processRef) {
          this.processRef.process = null;
        }

        // Best Practice: Notify clients that system continues without SUMO
        if (this.io && code !== 0) {
          this.io.emit('sumo:status', {
            running: false,
            status: 'stopped',
            message: 'SUMO simulation unavailable. All other features operational.'
          });
        }
        
        onExit(code, signal);
      });

      return {
        success: true,
        pid: this.process.pid,
        binary: sumoBinary,
        configPath: cfgPath
      };

    } catch (error) {
      logger.error(`Failed to spawn SUMO bridge: ${error.message}`);
      this.isRunning = false;
      this.process = null;
      throw error;
    }
  }

  /**
   * Send a command to the running SUMO bridge via stdin
   * @param {Object} command - Command object to send
   * @returns {boolean} Whether the command was sent successfully
   */
  sendCommand(command) {
    try {
      if (!this.process) {
        logger.error('Cannot send command: SUMO bridge not running');
        return false;
      }

      if (!this.process.stdin) {
        logger.error('Cannot send command: SUMO bridge stdin not available');
        return false;
      }

      if (this.process.killed) {
        logger.error('Cannot send command: SUMO bridge was killed');
        return false;
      }

      const line = JSON.stringify(command) + '\n';
      logger.debug(`Sending command to SUMO bridge: ${line.trim()}`);
      
      const writeResult = this.process.stdin.write(line, 'utf8');
      
      // Force flush if available
      if (typeof this.process.stdin.flush === 'function') {
        this.process.stdin.flush();
      }

      return writeResult;
    } catch (error) {
      logger.error(`Failed to send command to SUMO bridge: ${error.message}`);
      return false;
    }
  }

  /**
   * Kill the running SUMO bridge process
   * @param {string} signal - Signal to send (default: SIGTERM)
   */
  kill(signal = 'SIGTERM') {
    if (this.process) {
      try {
        logger.info(`Killing SUMO bridge process with signal ${signal}`);
        this.process.kill(signal);
        this.process = null;
        this.isRunning = false;
        
        // Clear shared reference if available
        if (this.processRef) {
          this.processRef.process = null;
        }
      } catch (error) {
        logger.error(`Failed to kill SUMO bridge: ${error.message}`);
      }
    }
  }

  /**
   * Check if the SUMO bridge is currently running
   * @returns {boolean}
   */
  getIsRunning() {
    return this.isRunning && this.process !== null;
  }

  /**
   * Get the current process information
   * @returns {Object|null}
   */
  getProcessInfo() {
    if (!this.process) return null;
    return {
      pid: this.process.pid,
      killed: this.process.killed,
      exitCode: this.process.exitCode,
      signalCode: this.process.signalCode
    };
  }
}

module.exports = new SumoSubprocessService();
