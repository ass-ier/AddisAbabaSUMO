const mongoose = require('mongoose');

/**
 * TrafficData Schema - For storing traffic simulation data from SUMO
 * Contains real-time and historical traffic metrics
 */
const TrafficDataSchema = new mongoose.Schema({
  // Timestamp and identification
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  simulationTime: {
    type: Number, // Simulation time in seconds
    required: true
  },
  
  // Location information
  intersectionId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  roadId: {
    type: String,
    trim: true,
    index: true
  },
  
  laneId: {
    type: String,
    trim: true
  },
  
  // Traffic metrics
  vehicleCount: {
    type: Number,
    min: [0, 'Vehicle count cannot be negative'],
    default: 0,
    required: true
  },
  
  averageSpeed: {
    type: Number, // Speed in km/h or m/s
    min: [0, 'Speed cannot be negative'],
    default: 0
  },
  
  maxSpeed: {
    type: Number,
    min: [0, 'Max speed cannot be negative'],
    default: 0
  },
  
  trafficFlow: {
    type: Number, // Vehicles per hour
    min: [0, 'Traffic flow cannot be negative'],
    default: 0
  },
  
  density: {
    type: Number, // Vehicles per km
    min: [0, 'Density cannot be negative'],
    default: 0
  },
  
  occupancy: {
    type: Number, // Percentage (0-100)
    min: [0, 'Occupancy cannot be negative'],
    max: [100, 'Occupancy cannot exceed 100%'],
    default: 0
  },
  
  // Queue and waiting metrics
  queueLength: {
    type: Number, // Number of waiting vehicles
    min: [0, 'Queue length cannot be negative'],
    default: 0
  },
  
  averageWaitingTime: {
    type: Number, // Average waiting time in seconds
    min: [0, 'Waiting time cannot be negative'],
    default: 0
  },
  
  maxWaitingTime: {
    type: Number, // Maximum waiting time in seconds
    min: [0, 'Max waiting time cannot be negative'],
    default: 0
  },
  
  // Traffic light information
  trafficLightState: {
    type: String,
    enum: ['red', 'yellow', 'green', 'red_yellow', 'off', 'unknown'],
    default: 'unknown'
  },
  
  cycleTime: {
    type: Number, // Traffic light cycle time in seconds
    min: [0, 'Cycle time cannot be negative']
  },
  
  phaseTime: {
    type: Number, // Current phase time in seconds
    min: [0, 'Phase time cannot be negative']
  },
  
  // Environmental data
  co2Emissions: {
    type: Number, // CO2 emissions in mg/s
    min: [0, 'Emissions cannot be negative'],
    default: 0
  },
  
  fuelConsumption: {
    type: Number, // Fuel consumption in ml/s
    min: [0, 'Fuel consumption cannot be negative'],
    default: 0
  },
  
  noiseLevel: {
    type: Number, // Noise level in dB
    min: [0, 'Noise level cannot be negative'],
    default: 0
  },
  
  // Vehicle type breakdown
  vehicleTypes: {
    cars: {
      type: Number,
      min: [0, 'Car count cannot be negative'],
      default: 0
    },
    buses: {
      type: Number,
      min: [0, 'Bus count cannot be negative'],
      default: 0
    },
    trucks: {
      type: Number,
      min: [0, 'Truck count cannot be negative'],
      default: 0
    },
    motorcycles: {
      type: Number,
      min: [0, 'Motorcycle count cannot be negative'],
      default: 0
    },
    bicycles: {
      type: Number,
      min: [0, 'Bicycle count cannot be negative'],
      default: 0
    },
    pedestrians: {
      type: Number,
      min: [0, 'Pedestrian count cannot be negative'],
      default: 0
    },
    emergency: {
      type: Number,
      min: [0, 'Emergency vehicle count cannot be negative'],
      default: 0
    },
    other: {
      type: Number,
      min: [0, 'Other vehicle count cannot be negative'],
      default: 0
    }
  },
  
  // Weather impact
  weather: {
    condition: {
      type: String,
      enum: ['clear', 'rain', 'snow', 'fog', 'storm', 'unknown'],
      default: 'unknown'
    },
    temperature: Number, // Temperature in Celsius
    humidity: {
      type: Number, // Humidity percentage
      min: [0, 'Humidity cannot be negative'],
      max: [100, 'Humidity cannot exceed 100%']
    },
    windSpeed: {
      type: Number, // Wind speed in km/h
      min: [0, 'Wind speed cannot be negative']
    },
    visibility: {
      type: Number, // Visibility in meters
      min: [0, 'Visibility cannot be negative']
    }
  },
  
  // Incident flags
  incidents: [{
    type: {
      type: String,
      enum: ['accident', 'breakdown', 'construction', 'event', 'other']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    description: String,
    duration: Number // Duration in seconds
  }],
  
  // System metadata
  dataSource: {
    type: String,
    enum: ['sumo_simulation', 'real_sensors', 'manual_input', 'api_import'],
    default: 'sumo_simulation',
    required: true
  },
  
  dataQuality: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  
  confidence: {
    type: Number, // Confidence score (0-1)
    min: [0, 'Confidence cannot be negative'],
    max: [1, 'Confidence cannot exceed 1'],
    default: 1
  },
  
  // Aggregation metadata
  isAggregated: {
    type: Boolean,
    default: false
  },
  
  aggregationPeriod: {
    type: Number, // Aggregation period in minutes
    min: [0, 'Aggregation period cannot be negative']
  },
  
  aggregationMethod: {
    type: String,
    enum: ['average', 'sum', 'max', 'min', 'median'],
    default: 'average'
  },
  
  // Processing metadata
  processedAt: {
    type: Date,
    default: Date.now
  },
  
  processingVersion: {
    type: String,
    default: '1.0'
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

// Indexes for performance (timestamp, intersectionId, and roadId already have indexes from schema definition)
TrafficDataSchema.index({ simulationTime: 1 });
TrafficDataSchema.index({ dataSource: 1 });

// Compound indexes for common queries (avoiding duplicate timestamp indexes)
TrafficDataSchema.index({ intersectionId: 1, vehicleCount: 1 });
TrafficDataSchema.index({ averageSpeed: 1 });
TrafficDataSchema.index({ trafficFlow: 1 });

// TTL index to automatically delete old data (30 days) - separate from the basic index
TrafficDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Pre-save middleware to validate data consistency
TrafficDataSchema.pre('save', function(next) {
  // Validate vehicle count matches sum of vehicle types
  const typeSum = Object.values(this.vehicleTypes || {}).reduce((sum, count) => sum + (count || 0), 0);
  if (typeSum > 0 && this.vehicleCount !== typeSum) {
    this.vehicleCount = typeSum;
  }
  
  // Ensure occupancy is reasonable based on vehicle count and density
  if (this.density > 0 && this.vehicleCount > 0) {
    // Basic validation - adjust if needed based on road characteristics
    const estimatedOccupancy = Math.min(100, (this.vehicleCount / this.density) * 100);
    if (this.occupancy === 0) {
      this.occupancy = estimatedOccupancy;
    }
  }
  
  next();
});

// Instance method to calculate congestion level
TrafficDataSchema.methods.getCongestionLevel = function() {
  // Simple congestion calculation based on speed and occupancy
  const speedFactor = this.averageSpeed < 20 ? 0.3 : this.averageSpeed < 40 ? 0.6 : 1.0;
  const occupancyFactor = this.occupancy > 80 ? 0.2 : this.occupancy > 60 ? 0.5 : this.occupancy > 40 ? 0.8 : 1.0;
  
  const congestionScore = (speedFactor + occupancyFactor) / 2;
  
  if (congestionScore < 0.3) return 'severe';
  if (congestionScore < 0.5) return 'heavy';
  if (congestionScore < 0.7) return 'moderate';
  if (congestionScore < 0.9) return 'light';
  return 'free_flow';
};

// Instance method to get efficiency score
TrafficDataSchema.methods.getEfficiencyScore = function() {
  // Calculate efficiency based on multiple factors (0-100 scale)
  let score = 100;
  
  // Penalize low speeds
  if (this.averageSpeed < 30) score -= 20;
  else if (this.averageSpeed < 50) score -= 10;
  
  // Penalize high waiting times
  if (this.averageWaitingTime > 60) score -= 20;
  else if (this.averageWaitingTime > 30) score -= 10;
  
  // Penalize high occupancy
  if (this.occupancy > 80) score -= 15;
  else if (this.occupancy > 60) score -= 5;
  
  // Penalize long queues
  if (this.queueLength > 20) score -= 15;
  else if (this.queueLength > 10) score -= 8;
  
  // Penalize high emissions
  if (this.co2Emissions > 1000) score -= 10;
  else if (this.co2Emissions > 500) score -= 5;
  
  return Math.max(0, Math.min(100, score));
};

// Static method to get recent data
TrafficDataSchema.statics.getRecent = function(intersectionId = null, minutes = 15) {
  const query = {
    timestamp: { $gte: new Date(Date.now() - minutes * 60 * 1000) }
  };
  
  if (intersectionId) {
    query.intersectionId = intersectionId;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

// Static method to get aggregated data
TrafficDataSchema.statics.getAggregatedData = async function(intersectionId, startDate, endDate, groupBy = 'hour') {
  const matchStage = {
    timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
  };
  
  if (intersectionId) {
    matchStage.intersectionId = intersectionId;
  }
  
  let groupKey;
  switch (groupBy) {
    case 'minute':
      groupKey = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' },
        minute: { $minute: '$timestamp' }
      };
      break;
    case 'hour':
      groupKey = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' }
      };
      break;
    case 'day':
      groupKey = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' }
      };
      break;
    default:
      groupKey = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' }
      };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupKey,
        avgVehicleCount: { $avg: '$vehicleCount' },
        avgSpeed: { $avg: '$averageSpeed' },
        avgTrafficFlow: { $avg: '$trafficFlow' },
        avgWaitingTime: { $avg: '$averageWaitingTime' },
        avgOccupancy: { $avg: '$occupancy' },
        totalCO2: { $sum: '$co2Emissions' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 } }
  ]);
};

// Virtual for total vehicles by type
TrafficDataSchema.virtual('totalVehiclesByType').get(function() {
  const types = this.vehicleTypes || {};
  return Object.values(types).reduce((sum, count) => sum + (count || 0), 0);
});

module.exports = mongoose.model('TrafficData', TrafficDataSchema);