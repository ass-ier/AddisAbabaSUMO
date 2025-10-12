const mongoose = require('mongoose');

/**
 * SumoLog Schema - For storing SUMO integration logs with user context
 * 24-hour retention with automatic cleanup
 */
const SumoLogSchema = new mongoose.Schema({
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
    expires: 86400 // 24 hours TTL in seconds
  },
  
  // Log content
  message: {
    type: String,
    required: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  
  type: {
    type: String,
    required: true,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info',
    index: true
  },
  
  // User context
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  username: {
    type: String,
    required: true,
    index: true
  },
  
  userRole: {
    type: String,
    enum: ['super_admin', 'admin', 'system_operator', 'user'],
    required: true,
    index: true
  },
  
  userFullName: {
    type: String,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  
  // Action context
  action: {
    type: String,
    maxlength: [200, 'Action cannot exceed 200 characters'],
    index: true
  },
  
  category: {
    type: String,
    enum: [
      'simulation_control',
      'configuration',
      'scenario_change',
      'system_status',
      'connection',
      'other'
    ],
    default: 'other',
    index: true
  },
  
  // Session context
  sessionId: {
    type: String,
    index: true
  },
  
  // Additional metadata
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // System metadata
  environment: {
    type: String,
    enum: ['production', 'staging', 'development', 'test'],
    default: process.env.NODE_ENV || 'development'
  },
  
  source: {
    type: String,
    default: 'sumo_integration',
    index: true
  }
}, {
  timestamps: false, // Using custom timestamp field
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for efficient queries
SumoLogSchema.index({ username: 1, timestamp: -1 });
SumoLogSchema.index({ type: 1, timestamp: -1 });
SumoLogSchema.index({ category: 1, timestamp: -1 });

// Static method to create log entry with user context
SumoLogSchema.statics.createEntry = function(data, userContext = {}) {
  const entry = new this({
    timestamp: new Date(),
    userId: userContext._id,
    username: userContext.username || 'anonymous',
    userRole: userContext.role || 'user',
    userFullName: userContext.fullName || userContext.name,
    sessionId: userContext.sessionId,
    ...data
  });
  
  return entry.save();
};

// Static method to get recent logs for a user
SumoLogSchema.statics.getRecentLogs = function(options = {}) {
  const {
    username = null,
    type = null,
    category = null,
    limit = 100,
    since = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
  } = options;
  
  const query = { timestamp: { $gte: since } };
  
  if (username) query.username = username;
  if (type) query.type = type;
  if (category) query.category = category;
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to cleanup old logs (backup - TTL should handle this)
SumoLogSchema.statics.cleanup = async function(olderThanHours = 24) {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  return this.deleteMany({ timestamp: { $lt: cutoff } });
};

// Instance method to check if log should be highlighted
SumoLogSchema.methods.isImportant = function() {
  return this.type === 'error' || 
         (this.type === 'warning' && this.category === 'simulation_control') ||
         (this.category === 'system_status' && this.type !== 'info');
};

module.exports = mongoose.model('SumoLog', SumoLogSchema);