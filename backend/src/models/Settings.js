const mongoose = require('mongoose');

/**
 * Settings Schema - For storing system-wide configuration and preferences
 * Single document that stores all system settings
 */
const SettingsSchema = new mongoose.Schema({
  // System identification
  systemName: {
    type: String,
    default: 'Traffic Management System',
    maxlength: [100, 'System name cannot exceed 100 characters']
  },
  
  version: {
    type: String,
    default: '1.0.0',
    match: [/^\d+\.\d+\.\d+/, 'Version must follow semantic versioning (x.y.z)']
  },
  
  // SUMO Configuration
  sumo: {
    enabled: {
      type: Boolean,
      default: true
    },
    executablePath: {
      type: String,
      default: '/usr/bin/sumo',
      trim: true
    },
    guiEnabled: {
      type: Boolean,
      default: false
    },
    stepLength: {
      type: Number,
      default: 0.1,
      min: [0.01, 'Step length must be at least 0.01'],
      max: [10, 'Step length cannot exceed 10']
    },
    maxSteps: {
      type: Number,
      default: 3600,
      min: [1, 'Max steps must be at least 1']
    },
    defaultNetworkFile: {
      type: String,
      trim: true
    },
    defaultRouteFile: {
      type: String,
      trim: true
    },
    additionalFiles: [{
      type: String,
      trim: true
    }],
    outputDirectory: {
      type: String,
      default: './sumo_output',
      trim: true
    },
    logLevel: {
      type: String,
      enum: ['debug', 'info', 'warning', 'error'],
      default: 'info'
    }
  },
  
  // Traffic Light Settings
  trafficLights: {
    defaultCycleTime: {
      type: Number,
      default: 120, // seconds
      min: [30, 'Cycle time must be at least 30 seconds'],
      max: [300, 'Cycle time cannot exceed 300 seconds']
    },
    emergencyOverrideEnabled: {
      type: Boolean,
      default: true
    },
    adaptiveControlEnabled: {
      type: Boolean,
      default: true
    },
    minimumGreenTime: {
      type: Number,
      default: 7, // seconds
      min: [3, 'Minimum green time must be at least 3 seconds']
    },
    maximumRedTime: {
      type: Number,
      default: 180, // seconds
      min: [30, 'Maximum red time must be at least 30 seconds']
    },
    yellowTime: {
      type: Number,
      default: 3, // seconds
      min: [2, 'Yellow time must be at least 2 seconds'],
      max: [6, 'Yellow time cannot exceed 6 seconds']
    },
    allRedTime: {
      type: Number,
      default: 2, // seconds
      min: [1, 'All red time must be at least 1 second']
    }
  },
  
  // Data Collection Settings
  dataCollection: {
    enabled: {
      type: Boolean,
      default: true
    },
    interval: {
      type: Number,
      default: 10, // seconds
      min: [1, 'Data collection interval must be at least 1 second'],
      max: [300, 'Data collection interval cannot exceed 300 seconds']
    },
    retentionDays: {
      type: Number,
      default: 30,
      min: [1, 'Retention period must be at least 1 day'],
      max: [365, 'Retention period cannot exceed 365 days']
    },
    aggregationEnabled: {
      type: Boolean,
      default: true
    },
    aggregationIntervals: {
      minute: { type: Boolean, default: true },
      hour: { type: Boolean, default: true },
      day: { type: Boolean, default: true }
    },
    metrics: {
      vehicleCount: { type: Boolean, default: true },
      speed: { type: Boolean, default: true },
      waitingTime: { type: Boolean, default: true },
      emissions: { type: Boolean, default: false },
      fuel: { type: Boolean, default: false }
    }
  },
  
  // Emergency Response Settings
  emergency: {
    autoResponseEnabled: {
      type: Boolean,
      default: true
    },
    responseTimeTarget: {
      type: Number,
      default: 300, // seconds (5 minutes)
      min: [60, 'Response time target must be at least 60 seconds']
    },
    priorityOverride: {
      type: Boolean,
      default: true
    },
    notificationChannels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      webhook: { type: Boolean, default: false }
    },
    escalationRules: {
      level1: {
        timeMinutes: { type: Number, default: 15 },
        roles: [{ type: String, default: 'system_operator' }]
      },
      level2: {
        timeMinutes: { type: Number, default: 30 },
        roles: [{ type: String, default: 'admin' }]
      },
      level3: {
        timeMinutes: { type: Number, default: 60 },
        roles: [{ type: String, default: 'super_admin' }]
      }
    }
  },
  
  // User Management Settings
  users: {
    registrationEnabled: {
      type: Boolean,
      default: false
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    passwordPolicy: {
      minLength: { type: Number, default: 8, min: [6, 'Password minimum length must be at least 6'] },
      requireUppercase: { type: Boolean, default: true },
      requireLowercase: { type: Boolean, default: true },
      requireNumbers: { type: Boolean, default: true },
      requireSpecialChars: { type: Boolean, default: false },
      maxAge: { type: Number, default: 90 } // days
    },
    sessionTimeout: {
      type: Number,
      default: 480, // minutes (8 hours)
      min: [15, 'Session timeout must be at least 15 minutes']
    },
    maxConcurrentSessions: {
      type: Number,
      default: 3,
      min: [1, 'Max concurrent sessions must be at least 1']
    }
  },
  
  // Security Settings
  security: {
    auditLoggingEnabled: {
      type: Boolean,
      default: true
    },
    bruteForceProtection: {
      enabled: { type: Boolean, default: true },
      maxAttempts: { type: Number, default: 5 },
      lockoutDuration: { type: Number, default: 900 } // seconds (15 minutes)
    },
    rateLimiting: {
      enabled: { type: Boolean, default: true },
      windowMs: { type: Number, default: 900000 }, // 15 minutes
      maxRequests: { type: Number, default: 100 }
    },
    encryptionKey: {
      type: String,
      select: false // Hide from queries by default
    },
    jwtSecret: {
      type: String,
      select: false // Hide from queries by default
    },
    jwtExpiry: {
      type: String,
      default: '8h'
    },
    corsEnabled: {
      type: Boolean,
      default: true
    },
    corsOrigins: [{
      type: String,
      trim: true
    }]
  },
  
  // API Settings
  api: {
    enabled: {
      type: Boolean,
      default: true
    },
    version: {
      type: String,
      default: 'v1'
    },
    documentation: {
      enabled: { type: Boolean, default: true },
      path: { type: String, default: '/docs' }
    },
    healthCheck: {
      enabled: { type: Boolean, default: true },
      path: { type: String, default: '/health' }
    },
    timeout: {
      type: Number,
      default: 30000, // 30 seconds
      min: [1000, 'API timeout must be at least 1000ms']
    }
  },
  
  // Database Settings
  database: {
    connectionTimeout: {
      type: Number,
      default: 30000, // 30 seconds
      min: [5000, 'Connection timeout must be at least 5000ms']
    },
    queryTimeout: {
      type: Number,
      default: 15000, // 15 seconds
      min: [1000, 'Query timeout must be at least 1000ms']
    },
    poolSize: {
      type: Number,
      default: 10,
      min: [1, 'Pool size must be at least 1'],
      max: [100, 'Pool size cannot exceed 100']
    },
    backupEnabled: {
      type: Boolean,
      default: true
    },
    backupFrequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily'
    }
  },
  
  // Notification Settings
  notifications: {
    email: {
      enabled: { type: Boolean, default: true },
      host: { type: String, trim: true },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      username: { type: String, trim: true },
      password: { type: String, select: false },
      from: { type: String, trim: true }
    },
    slack: {
      enabled: { type: Boolean, default: false },
      webhookUrl: { type: String, select: false },
      channel: { type: String, default: '#traffic-alerts' }
    },
    webhook: {
      enabled: { type: Boolean, default: false },
      url: { type: String, trim: true },
      secret: { type: String, select: false }
    }
  },
  
  // System Maintenance
  maintenance: {
    mode: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'System under maintenance. Please try again later.',
      maxlength: [200, 'Maintenance message cannot exceed 200 characters']
    },
    allowedIPs: [{
      type: String,
      match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, 'Invalid IP address format']
    }],
    scheduledStart: {
      type: Date
    },
    scheduledEnd: {
      type: Date
    }
  },
  
  // Feature Flags
  features: {
    dashboard: { type: Boolean, default: true },
    reports: { type: Boolean, default: true },
    realTimeMonitoring: { type: Boolean, default: true },
    historicalAnalysis: { type: Boolean, default: true },
    emergencyManagement: { type: Boolean, default: true },
    userManagement: { type: Boolean, default: true },
    systemConfiguration: { type: Boolean, default: true },
    apiAccess: { type: Boolean, default: true },
    mobileApp: { type: Boolean, default: false },
    externalIntegrations: { type: Boolean, default: false }
  },
  
  // UI/UX Settings
  ui: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en',
      maxlength: [2, 'Language code must be 2 characters']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    },
    refreshInterval: {
      type: Number,
      default: 30, // seconds
      min: [5, 'Refresh interval must be at least 5 seconds'],
      max: [300, 'Refresh interval cannot exceed 300 seconds']
    }
  },
  
  // Custom Settings (extensible)
  custom: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

// Indexes
SettingsSchema.index({ updatedAt: -1 });

// Pre-save middleware for validation
SettingsSchema.pre('save', function(next) {
  // Validate maintenance schedule
  if (this.maintenance.scheduledStart && this.maintenance.scheduledEnd) {
    if (this.maintenance.scheduledStart >= this.maintenance.scheduledEnd) {
      return next(new Error('Maintenance start time must be before end time'));
    }
  }
  
  // Validate SUMO step length and max steps relationship
  if (this.sumo.stepLength && this.sumo.maxSteps) {
    const totalTime = this.sumo.stepLength * this.sumo.maxSteps;
    if (totalTime > 86400) { // 24 hours in seconds
      console.warn('SUMO simulation time exceeds 24 hours');
    }
  }
  
  next();
});

// Static method to get system settings (ensures only one document exists)
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Static method to update specific setting
SettingsSchema.statics.updateSetting = async function(path, value) {
  const updateObj = {};
  updateObj[path] = value;
  updateObj.updatedAt = new Date();
  
  return await this.findOneAndUpdate(
    {},
    { $set: updateObj },
    { new: true, upsert: true }
  );
};

// Static method to get specific setting value
SettingsSchema.statics.getSetting = async function(path, defaultValue = null) {
  const settings = await this.getSettings();
  const keys = path.split('.');
  let value = settings.toObject();
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value !== undefined ? value : defaultValue;
};

// Instance method to check if feature is enabled
SettingsSchema.methods.isFeatureEnabled = function(featureName) {
  return this.features && this.features[featureName] === true;
};

// Instance method to check if system is in maintenance mode
SettingsSchema.methods.isMaintenanceMode = function() {
  return this.maintenance && this.maintenance.mode === true;
};

// Instance method to check if IP is allowed during maintenance
SettingsSchema.methods.isMaintenanceAllowed = function(ipAddress) {
  if (!this.isMaintenanceMode()) {
    return true;
  }
  
  return this.maintenance.allowedIPs && 
         this.maintenance.allowedIPs.includes(ipAddress);
};

// Instance method to validate password against policy
SettingsSchema.methods.validatePassword = function(password) {
  const policy = this.users.passwordPolicy;
  const errors = [];
  
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Virtual for system health check
SettingsSchema.virtual('systemHealth').get(function() {
  const issues = [];
  
  // Check SUMO configuration
  if (!this.sumo.enabled) {
    issues.push('SUMO simulation is disabled');
  }
  
  // Check data collection
  if (!this.dataCollection.enabled) {
    issues.push('Data collection is disabled');
  }
  
  // Check security settings
  if (!this.security.auditLoggingEnabled) {
    issues.push('Audit logging is disabled');
  }
  
  return {
    healthy: issues.length === 0,
    issues
  };
});

module.exports = mongoose.model('Settings', SettingsSchema);