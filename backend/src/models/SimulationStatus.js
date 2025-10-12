const mongoose = require('mongoose');

/**
 * SimulationStatus Schema - For tracking SUMO simulation state and execution
 * Maintains current status, configuration, and execution history
 */
const SimulationStatusSchema = new mongoose.Schema({
  // Simulation identification
  simulationId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Simulation name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Execution status
  isRunning: {
    type: Boolean,
    default: false,
    required: true
  },
  
  status: {
    type: String,
    enum: ['stopped', 'starting', 'running', 'paused', 'stopping', 'error', 'completed'],
    default: 'stopped',
    required: true
  },
  
  // Timing information
  startTime: {
    type: Date,
    default: null
  },
  
  endTime: {
    type: Date,
    default: null
  },
  
  pausedTime: {
    type: Date,
    default: null
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Simulation configuration
  configuration: {
    networkFile: {
      type: String,
      required: true,
      trim: true
    },
    routeFile: {
      type: String,
      trim: true
    },
    additionalFiles: [{
      type: String,
      trim: true
    }],
    stepLength: {
      type: Number,
      default: 0.1,
      min: [0.01, 'Step length must be at least 0.01'],
      max: [10, 'Step length cannot exceed 10']
    },
    totalSteps: {
      type: Number,
      required: true,
      min: [1, 'Total steps must be at least 1']
    },
    currentStep: {
      type: Number,
      default: 0,
      min: [0, 'Current step cannot be negative']
    },
    guiEnabled: {
      type: Boolean,
      default: false
    },
    outputDirectory: {
      type: String,
      default: './sumo_output',
      trim: true
    },
    outputFiles: {
      vehicleData: { type: String, trim: true },
      laneData: { type: String, trim: true },
      junctionData: { type: String, trim: true },
      emissionData: { type: String, trim: true },
      summary: { type: String, trim: true }
    }
  },
  
  // Process information
  process: {
    pid: {
      type: Number,
      min: [1, 'Process ID must be positive']
    },
    command: {
      type: String,
      trim: true
    },
    arguments: [{
      type: String,
      trim: true
    }],
    workingDirectory: {
      type: String,
      trim: true
    },
    environmentVariables: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Performance metrics
  performance: {
    realTimeRatio: {
      type: Number,
      min: [0, 'Real time ratio cannot be negative'],
      default: 1.0
    },
    simulationTime: {
      type: Number, // Current simulation time in seconds
      min: [0, 'Simulation time cannot be negative'],
      default: 0
    },
    stepsPerSecond: {
      type: Number,
      min: [0, 'Steps per second cannot be negative'],
      default: 0
    },
    memoryUsage: {
      type: Number, // Memory usage in MB
      min: [0, 'Memory usage cannot be negative'],
      default: 0
    },
    cpuUsage: {
      type: Number, // CPU usage percentage
      min: [0, 'CPU usage cannot be negative'],
      max: [100, 'CPU usage cannot exceed 100%'],
      default: 0
    }
  },
  
  // Traffic statistics
  trafficStats: {
    totalVehicles: {
      type: Number,
      min: [0, 'Total vehicles cannot be negative'],
      default: 0
    },
    activeVehicles: {
      type: Number,
      min: [0, 'Active vehicles cannot be negative'],
      default: 0
    },
    vehiclesLoaded: {
      type: Number,
      min: [0, 'Vehicles loaded cannot be negative'],
      default: 0
    },
    vehiclesCompleted: {
      type: Number,
      min: [0, 'Vehicles completed cannot be negative'],
      default: 0
    },
    averageSpeed: {
      type: Number,
      min: [0, 'Average speed cannot be negative'],
      default: 0
    },
    totalWaitingTime: {
      type: Number,
      min: [0, 'Total waiting time cannot be negative'],
      default: 0
    },
    totalTravelTime: {
      type: Number,
      min: [0, 'Total travel time cannot be negative'],
      default: 0
    }
  },
  
  // Error handling
  errorLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'critical'],
      default: 'error'
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      trim: true
    },
    source: {
      type: String,
      enum: ['sumo', 'system', 'user', 'network'],
      default: 'sumo'
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  
  // User tracking
  startedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  stoppedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Emergency overrides
  emergencyOverrides: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    emergencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Emergency'
    },
    type: {
      type: String,
      enum: ['traffic_light', 'route_change', 'speed_limit', 'lane_closure'],
      required: true
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    active: {
      type: Boolean,
      default: true
    }
  }],
  
  // Scenario information
  scenario: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Scenario name cannot exceed 100 characters']
    },
    type: {
      type: String,
      enum: ['baseline', 'emergency', 'optimization', 'test', 'custom'],
      default: 'baseline'
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    expectedDuration: {
      type: Number, // Expected duration in simulation seconds
      min: [0, 'Expected duration cannot be negative']
    }
  },
  
  // Output and logging
  logs: {
    stdout: [{
      timestamp: { type: Date, default: Date.now },
      message: { type: String, required: true }
    }],
    stderr: [{
      timestamp: { type: Date, default: Date.now },
      message: { type: String, required: true }
    }],
    maxEntries: {
      type: Number,
      default: 1000,
      min: [10, 'Max log entries must be at least 10']
    }
  },
  
  // Health monitoring
  health: {
    score: {
      type: Number,
      min: [0, 'Health score cannot be negative'],
      max: [100, 'Health score cannot exceed 100'],
      default: 100
    },
    issues: [{
      type: String,
      trim: true
    }],
    lastCheck: {
      type: Date,
      default: Date.now
    },
    checkInterval: {
      type: Number, // Health check interval in seconds
      default: 30,
      min: [5, 'Health check interval must be at least 5 seconds']
    }
  },
  
  // Metadata
  tags: [{
    type: String,
    trim: true
  }],
  
  priority: {
    type: Number,
    min: [1, 'Priority must be between 1 and 10'],
    max: [10, 'Priority must be between 1 and 10'],
    default: 5
  },
  
  autoRestart: {
    type: Boolean,
    default: false
  },
  
  restartAttempts: {
    type: Number,
    min: [0, 'Restart attempts cannot be negative'],
    default: 0
  },
  
  maxRestartAttempts: {
    type: Number,
    min: [0, 'Max restart attempts cannot be negative'],
    default: 3
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance (simulationId already has unique index from schema definition)
SimulationStatusSchema.index({ isRunning: 1 });
SimulationStatusSchema.index({ status: 1 });
SimulationStatusSchema.index({ lastUpdated: -1 });
SimulationStatusSchema.index({ startedBy: 1 });
SimulationStatusSchema.index({ 'scenario.type': 1 });

// Pre-save middleware to update lastUpdated and validate state
SimulationStatusSchema.pre('save', function(next) {
  // Update lastUpdated timestamp
  this.lastUpdated = new Date();
  
  // Validate status consistency
  if (this.isRunning && this.status === 'stopped') {
    this.isRunning = false;
  } else if (!this.isRunning && ['running', 'starting'].includes(this.status)) {
    this.isRunning = true;
  }
  
  // Set endTime when simulation stops
  if (this.isModified('status') && ['stopped', 'completed', 'error'].includes(this.status)) {
    if (!this.endTime) {
      this.endTime = new Date();
    }
    this.isRunning = false;
  }
  
  // Set startTime when simulation starts
  if (this.isModified('status') && ['starting', 'running'].includes(this.status)) {
    if (!this.startTime) {
      this.startTime = new Date();
    }
  }
  
  // Validate current step doesn't exceed total steps
  if (this.configuration.currentStep > this.configuration.totalSteps) {
    this.configuration.currentStep = this.configuration.totalSteps;
    this.status = 'completed';
    this.isRunning = false;
  }
  
  // Limit log entries
  if (this.logs.stdout.length > this.logs.maxEntries) {
    this.logs.stdout = this.logs.stdout.slice(-this.logs.maxEntries);
  }
  if (this.logs.stderr.length > this.logs.maxEntries) {
    this.logs.stderr = this.logs.stderr.slice(-this.logs.maxEntries);
  }
  
  next();
});

// Pre-save middleware to generate simulationId if not provided
SimulationStatusSchema.pre('save', function(next) {
  if (!this.simulationId) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.simulationId = `SIM-${timestamp}-${random}`;
  }
  next();
});

// Instance method to calculate progress percentage
SimulationStatusSchema.methods.getProgress = function() {
  if (this.configuration.totalSteps === 0) return 0;
  return Math.min(100, (this.configuration.currentStep / this.configuration.totalSteps) * 100);
};

// Instance method to calculate duration
SimulationStatusSchema.methods.getDuration = function() {
  if (!this.startTime) return 0;
  const endTime = this.endTime || new Date();
  return Math.round((endTime - this.startTime) / 1000); // Duration in seconds
};

// Instance method to estimate remaining time
SimulationStatusSchema.methods.getEstimatedRemainingTime = function() {
  const progress = this.getProgress();
  if (progress === 0 || progress === 100) return 0;
  
  const duration = this.getDuration();
  const totalEstimated = duration / (progress / 100);
  return Math.round(totalEstimated - duration);
};

// Instance method to add log entry
SimulationStatusSchema.methods.addLog = function(type, message) {
  const logEntry = {
    timestamp: new Date(),
    message: message
  };
  
  if (type === 'stdout') {
    this.logs.stdout.push(logEntry);
    if (this.logs.stdout.length > this.logs.maxEntries) {
      this.logs.stdout = this.logs.stdout.slice(-this.logs.maxEntries);
    }
  } else if (type === 'stderr') {
    this.logs.stderr.push(logEntry);
    if (this.logs.stderr.length > this.logs.maxEntries) {
      this.logs.stderr = this.logs.stderr.slice(-this.logs.maxEntries);
    }
  }
  
  return this.save();
};

// Instance method to add error
SimulationStatusSchema.methods.addError = function(message, level = 'error', code = null, source = 'sumo') {
  this.errorLog.push({
    timestamp: new Date(),
    level,
    message,
    code,
    source,
    resolved: false
  });
  
  // Update health score based on error level
  if (level === 'critical') {
    this.health.score = Math.max(0, this.health.score - 30);
  } else if (level === 'error') {
    this.health.score = Math.max(0, this.health.score - 15);
  } else if (level === 'warning') {
    this.health.score = Math.max(0, this.health.score - 5);
  }
  
  this.health.lastCheck = new Date();
  return this.save();
};

// Instance method to check if simulation is stale
SimulationStatusSchema.methods.isStale = function(timeoutMinutes = 5) {
  const timeout = timeoutMinutes * 60 * 1000; // Convert to milliseconds
  return (new Date() - this.lastUpdated) > timeout;
};

// Static method to find active simulations
SimulationStatusSchema.statics.findActive = function() {
  return this.find({ isRunning: true }).sort({ startTime: -1 });
};

// Static method to find by status
SimulationStatusSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ lastUpdated: -1 });
};

// Static method to get simulation statistics
SimulationStatusSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        running: { $sum: { $cond: ['$isRunning', 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
        avgHealthScore: { $avg: '$health.score' },
        totalVehicles: { $sum: '$trafficStats.totalVehicles' }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    running: 0,
    completed: 0,
    errors: 0,
    avgHealthScore: 100,
    totalVehicles: 0
  };
};

// Static method to cleanup old simulations
SimulationStatusSchema.statics.cleanupOld = async function(daysOld = 7) {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return await this.deleteMany({
    status: { $in: ['completed', 'error', 'stopped'] },
    lastUpdated: { $lt: cutoff }
  });
};

// Virtual for simulation efficiency
SimulationStatusSchema.virtual('efficiency').get(function() {
  if (!this.performance.realTimeRatio) return 0;
  return Math.min(100, this.performance.realTimeRatio * 100);
});

// Virtual for completion status
SimulationStatusSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed' || this.getProgress() >= 100;
});

module.exports = mongoose.model('SimulationStatus', SimulationStatusSchema);