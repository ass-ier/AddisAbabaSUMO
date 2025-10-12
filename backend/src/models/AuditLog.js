const mongoose = require('mongoose');

/**
 * AuditLog Schema - For tracking user actions and system events
 * Provides security audit trail and compliance logging
 */
const AuditLogSchema = new mongoose.Schema({
  // Timestamp and identification
  time: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  // User information
  user: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  role: {
    type: String,
    required: true,
    enum: ['super_admin', 'admin', 'system_operator', 'user', 'system'],
    index: true
  },
  
  // Action details
  action: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Action cannot exceed 100 characters']
  },
  
  category: {
    type: String,
    required: true,
    enum: [
      'authentication',
      'user_management',
      'traffic_control',
      'emergency_response',
      'system_configuration',
      'data_access',
      'simulation_control',
      'report_generation',
      'security',
      'system_maintenance',
      'api_access',
      'other'
    ],
    index: true
  },
  
  outcome: {
    type: String,
    required: true,
    enum: ['success', 'failure', 'partial', 'blocked'],
    default: 'success',
    index: true
  },
  
  // Request details
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    uppercase: true
  },
  
  endpoint: {
    type: String,
    trim: true,
    maxlength: [200, 'Endpoint cannot exceed 200 characters']
  },
  
  resource: {
    type: String,
    trim: true,
    maxlength: [100, 'Resource cannot exceed 100 characters']
  },
  
  resourceId: {
    type: String,
    trim: true
  },
  
  // Changes tracking
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    fields: [{
      type: String,
      trim: true
    }]
  },
  
  // System context
  sessionId: {
    type: String,
    trim: true,
    index: true
  },
  
  requestId: {
    type: String,
    trim: true,
    index: true
  },
  
  // Network information
  ipAddress: {
    type: String,
    trim: true,
    match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address format']
  },
  
  userAgent: {
    type: String,
    trim: true,
    maxlength: [500, 'User agent cannot exceed 500 characters']
  },
  
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Additional metadata
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Error information (for failed actions)
  error: {
    message: {
      type: String,
      trim: true
    },
    code: {
      type: String,
      trim: true
    },
    stack: {
      type: String,
      trim: true
    }
  },
  
  // Security flags
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },
  
  sensitive: {
    type: Boolean,
    default: false,
    index: true
  },
  
  compliance: {
    required: {
      type: Boolean,
      default: false
    },
    standard: {
      type: String,
      enum: ['GDPR', 'HIPAA', 'SOX', 'PCI_DSS', 'ISO_27001', 'Custom']
    },
    retention: {
      type: Number, // Retention period in days
      min: [1, 'Retention period must be at least 1 day']
    }
  },
  
  // Performance metrics
  duration: {
    type: Number, // Duration in milliseconds
    min: [0, 'Duration cannot be negative']
  },
  
  responseSize: {
    type: Number, // Response size in bytes
    min: [0, 'Response size cannot be negative']
  },
  
  // Correlation and tracing
  correlationId: {
    type: String,
    trim: true,
    index: true
  },
  
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog'
  },
  
  // Additional context
  tags: [{
    type: String,
    trim: true
  }],
  
  environment: {
    type: String,
    enum: ['production', 'staging', 'development', 'test'],
    default: 'production'
  },
  
  // System metadata
  version: {
    type: String,
    trim: true,
    default: '1.0'
  },
  
  source: {
    type: String,
    enum: ['web_app', 'mobile_app', 'api', 'system', 'scheduler', 'import'],
    default: 'web_app'
  }
}, {
  timestamps: false, // We use 'time' field instead
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      // Hide sensitive stack traces in JSON output
      if (ret.error && ret.error.stack) {
        delete ret.error.stack;
      }
      return ret;
    }
  }
});

// Indexes for performance and queries (fields with index: true already have basic indexes)
// Only add compound and additional indexes here
AuditLogSchema.index({ ipAddress: 1 });

// Compound indexes for common queries (avoiding duplicate time indexes)
AuditLogSchema.index({ category: 1, outcome: 1 });
AuditLogSchema.index({ user: 1, category: 1 });
AuditLogSchema.index({ riskLevel: 1, sensitive: 1 });

// Note: TTL (Time To Live) functionality would need to be implemented with a scheduled job
// since the time field already has a basic index and we can't create a TTL index on the same field

// Pre-save middleware to set risk level based on action and outcome
AuditLogSchema.pre('save', function(next) {
  // Auto-classify risk level if not set
  if (this.riskLevel === 'low') {
    if (this.category === 'authentication' && this.outcome === 'failure') {
      this.riskLevel = 'medium';
    } else if (this.category === 'user_management' && this.action.includes('delete')) {
      this.riskLevel = 'high';
    } else if (this.category === 'system_configuration') {
      this.riskLevel = 'medium';
    } else if (this.category === 'security' || this.sensitive) {
      this.riskLevel = 'high';
    }
  }
  
  // Mark certain actions as sensitive
  if (!this.sensitive) {
    const sensitiveActions = ['password', 'login', 'delete', 'admin', 'config', 'key'];
    const actionLower = this.action.toLowerCase();
    this.sensitive = sensitiveActions.some(term => actionLower.includes(term));
  }
  
  next();
});

// Static method to create audit log entry
AuditLogSchema.statics.createEntry = function(data) {
  const entry = new this({
    time: new Date(),
    ...data
  });
  
  return entry.save();
};

// Static method to find logs by user
AuditLogSchema.statics.findByUser = function(username, options = {}) {
  const {
    startDate = null,
    endDate = null,
    category = null,
    limit = 100,
    sort = { time: -1 }
  } = options;
  
  const query = { user: username };
  
  if (startDate && endDate) {
    query.time = { $gte: new Date(startDate), $lte: new Date(endDate) };
  } else if (startDate) {
    query.time = { $gte: new Date(startDate) };
  } else if (endDate) {
    query.time = { $lte: new Date(endDate) };
  }
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query).sort(sort).limit(limit);
};

// Static method to find security events
AuditLogSchema.statics.findSecurityEvents = function(options = {}) {
  const {
    riskLevel = null,
    startDate = null,
    endDate = null,
    limit = 100
  } = options;
  
  const query = {
    $or: [
      { category: 'security' },
      { riskLevel: { $in: ['high', 'critical'] } },
      { outcome: 'failure' },
      { sensitive: true }
    ]
  };
  
  if (riskLevel) {
    query.riskLevel = riskLevel;
  }
  
  if (startDate && endDate) {
    query.time = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  
  return this.find(query).sort({ time: -1 }).limit(limit);
};

// Static method to get audit statistics
AuditLogSchema.statics.getStatistics = async function(period = 24) {
  const since = new Date(Date.now() - period * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    { $match: { time: { $gte: since } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$outcome', 'success'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$outcome', 'failure'] }, 1, 0] } },
        highRisk: { $sum: { $cond: [{ $in: ['$riskLevel', ['high', 'critical']] }, 1, 0] } },
        byCategory: {
          $push: '$category'
        },
        byUser: {
          $push: '$user'
        }
      }
    }
  ]);
  
  const result = stats[0] || {
    total: 0,
    successful: 0,
    failed: 0,
    highRisk: 0,
    byCategory: [],
    byUser: []
  };
  
  // Count unique users and categories
  result.uniqueUsers = [...new Set(result.byUser)].length;
  result.uniqueCategories = [...new Set(result.byCategory)].length;
  
  return result;
};

// Static method to find failed login attempts
AuditLogSchema.statics.findFailedLogins = function(timeWindow = 1, limit = 100) {
  const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
  
  return this.find({
    category: 'authentication',
    action: { $regex: /login/i },
    outcome: 'failure',
    time: { $gte: since }
  }).sort({ time: -1 }).limit(limit);
};

// Static method to find suspicious activity
AuditLogSchema.statics.findSuspiciousActivity = function(options = {}) {
  const {
    timeWindow = 24, // hours
    limit = 50
  } = options;
  
  const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
  
  return this.find({
    time: { $gte: since },
    $or: [
      { riskLevel: 'critical' },
      { 
        category: 'authentication',
        outcome: 'failure',
        // Multiple failures from same IP
      },
      {
        category: 'user_management',
        action: { $regex: /(delete|disable|modify)/i }
      },
      {
        category: 'system_configuration'
      }
    ]
  }).sort({ time: -1 }).limit(limit);
};

// Instance method to check if log entry is old enough for archival
AuditLogSchema.methods.isArchivable = function(retentionDays = 90) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  return this.time < cutoff;
};

// Instance method to redact sensitive information
AuditLogSchema.methods.redact = function() {
  const redacted = this.toObject();
  
  if (redacted.details) {
    // Remove potentially sensitive fields from details
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential'];
    sensitiveFields.forEach(field => {
      if (redacted.details[field]) {
        redacted.details[field] = '[REDACTED]';
      }
    });
  }
  
  if (redacted.changes) {
    // Redact sensitive changes
    ['before', 'after'].forEach(key => {
      if (redacted.changes[key] && typeof redacted.changes[key] === 'object') {
        const sensitiveFields = ['password', 'token', 'key', 'secret'];
        sensitiveFields.forEach(field => {
          if (redacted.changes[key][field]) {
            redacted.changes[key][field] = '[REDACTED]';
          }
        });
      }
    });
  }
  
  return redacted;
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);