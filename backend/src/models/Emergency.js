const mongoose = require('mongoose');

/**
 * Emergency Schema - For tracking emergency incidents and their impact on traffic
 * Used by the traffic management system to handle emergency situations
 */
const EmergencySchema = new mongoose.Schema({
  // Emergency identification
  emergencyId: {
    type: String,
    unique: true,
    required: [true, 'Emergency ID is required'],
    trim: true
  },
  
  // Emergency type and description
  type: {
    type: String,
    enum: [
      'accident',
      'breakdown',
      'construction',
      'weather',
      'special_event',
      'road_closure',
      'traffic_signal_failure',
      'fire',
      'medical',
      'police',
      'other'
    ],
    required: [true, 'Emergency type is required']
  },
  
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    required: true
  },
  
  title: {
    type: String,
    required: [true, 'Emergency title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Emergency description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Location information
  location: {
    intersectionId: {
      type: String,
      trim: true
    },
    roadId: {
      type: String,
      trim: true
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    },
    address: {
      type: String,
      trim: true,
      maxlength: [300, 'Address cannot exceed 300 characters']
    }
  },
  
  // Status and timing
  active: {
    type: Boolean,
    default: true,
    required: true
  },
  
  status: {
    type: String,
    enum: ['reported', 'confirmed', 'responding', 'resolved', 'closed'],
    default: 'reported',
    required: true
  },
  
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  endTime: {
    type: Date,
    default: null
  },
  
  estimatedDuration: {
    type: Number, // Duration in minutes
    min: [0, 'Duration cannot be negative']
  },
  
  // Impact assessment
  trafficImpact: {
    affected_roads: [{
      type: String,
      trim: true
    }],
    affected_intersections: [{
      type: String,
      trim: true
    }],
    estimated_delay: {
      type: Number, // Delay in minutes
      min: [0, 'Delay cannot be negative']
    },
    congestion_level: {
      type: String,
      enum: ['none', 'light', 'moderate', 'heavy', 'severe'],
      default: 'none'
    }
  },
  
  // Response information
  responseTeam: {
    type: String,
    enum: ['police', 'fire', 'medical', 'traffic_control', 'maintenance', 'multiple'],
    default: null
  },
  
  responseStatus: {
    type: String,
    enum: ['dispatched', 'en_route', 'on_scene', 'resolved'],
    default: null
  },
  
  // System integration
  sumoSimulationImpact: {
    modifiedSignals: [{
      intersectionId: String,
      originalTiming: mongoose.Schema.Types.Mixed,
      emergencyTiming: mongoose.Schema.Types.Mixed
    }],
    reroutedTraffic: [{
      from: String,
      to: String,
      reason: String
    }]
  },
  
  // User tracking
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Additional metadata
  priority: {
    type: Number,
    min: [1, 'Priority must be between 1 and 10'],
    max: [10, 'Priority must be between 1 and 10'],
    default: 5
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  notes: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: [500, 'Note content cannot exceed 500 characters']
    }
  }],
  
  // External references
  externalId: {
    type: String,
    trim: true
  },
  
  source: {
    type: String,
    enum: ['manual', 'sensor', 'camera', 'api', 'citizen_report', 'emergency_services'],
    default: 'manual'
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

// Indexes for performance (emergencyId already has unique index from schema definition)
EmergencySchema.index({ active: 1 });
EmergencySchema.index({ status: 1 });
EmergencySchema.index({ type: 1 });
EmergencySchema.index({ severity: 1 });
EmergencySchema.index({ startTime: -1 });
EmergencySchema.index({ 'location.intersectionId': 1 });
EmergencySchema.index({ reportedBy: 1 });
EmergencySchema.index({ assignedTo: 1 });
EmergencySchema.index({ createdAt: -1 });

// Compound indexes
EmergencySchema.index({ active: 1, severity: -1, startTime: -1 });
EmergencySchema.index({ status: 1, priority: -1 });

// Pre-save middleware to generate emergencyId if not provided
EmergencySchema.pre('save', function(next) {
  if (!this.emergencyId) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.emergencyId = `EMG-${timestamp}-${random}`;
  }
  next();
});

// Pre-save middleware to set endTime when emergency is resolved
EmergencySchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'resolved' && !this.endTime) {
    this.endTime = new Date();
    this.active = false;
  }
  
  if (this.isModified('active') && !this.active && !this.endTime) {
    this.endTime = new Date();
  }
  
  next();
});

// Instance method to calculate duration
EmergencySchema.methods.getDuration = function() {
  if (this.endTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60)); // Duration in minutes
  }
  return Math.round((new Date() - this.startTime) / (1000 * 60)); // Current duration
};

// Instance method to add note
EmergencySchema.methods.addNote = function(content, authorId) {
  this.notes.push({
    content,
    author: authorId,
    timestamp: new Date()
  });
  return this.save();
};

// Instance method to check if emergency is overdue
EmergencySchema.methods.isOverdue = function() {
  if (this.estimatedDuration && this.active) {
    const currentDuration = this.getDuration();
    return currentDuration > this.estimatedDuration;
  }
  return false;
};

// Static method to find active emergencies
EmergencySchema.statics.findActive = function() {
  return this.find({ active: true }).sort({ priority: -1, startTime: -1 });
};

// Static method to find by severity
EmergencySchema.statics.findBySeverity = function(severity) {
  return this.find({ severity, active: true }).sort({ startTime: -1 });
};

// Static method to find by location
EmergencySchema.statics.findByLocation = function(intersectionId) {
  return this.find({ 'location.intersectionId': intersectionId }).sort({ startTime: -1 });
};

// Static method to get emergency statistics
EmergencySchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$active', 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        byType: {
          $push: {
            $cond: [
              '$active',
              '$type',
              null
            ]
          }
        },
        bySeverity: {
          $push: {
            $cond: [
              '$active',
              '$severity',
              null
            ]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    active: 0,
    resolved: 0,
    byType: [],
    bySeverity: []
  };
};

// Virtual for duration display
EmergencySchema.virtual('durationMinutes').get(function() {
  return this.getDuration();
});

module.exports = mongoose.model('Emergency', EmergencySchema);