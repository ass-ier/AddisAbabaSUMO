const Joi = require('joi');
const { AppError } = require('./errorHandler');

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      return next(new AppError(message, 400));
    }

    next();
  };
};

// Common validation schemas
const schemas = {
  // Authentication
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('super_admin', 'operator', 'analyst').required(),
    region: Joi.string().optional().allow(''),
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  }),

  // User management
  createUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('super_admin', 'operator', 'analyst').required(),
    region: Joi.string().max(100).optional().allow(''),
    // Profile fields required by the User model
    email: Joi.string().email().required(),
    firstName: Joi.string().max(50).required(),
    lastName: Joi.string().max(50).required(),
    phoneNumber: Joi.string().pattern(/^[\+]?[0-9][\d]{0,15}$/).optional().allow('')
  }),

  updateUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).optional(),
    password: Joi.string().min(6).optional(),
    role: Joi.string().valid('super_admin', 'operator', 'analyst').optional(),
    region: Joi.string().max(100).optional().allow(''),
  }),

  updateProfile: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).optional(),
    password: Joi.string().min(6).optional(),
    region: Joi.string().max(100).optional().allow(''),
    // Note: role is not allowed in profile updates
  }),

  // Traffic data
  trafficData: Joi.object({
    intersectionId: Joi.string().required(),
    trafficFlow: Joi.number().min(0).required(),
    signalStatus: Joi.string().required(),
    vehicleCount: Joi.number().min(0).default(0),
    averageSpeed: Joi.number().min(0).default(0),
  }),

  // SUMO control
  sumoControl: Joi.object({
    command: Joi.string()
      .valid('start_simulation', 'stop_simulation', 'pause_simulation', 'resume_simulation')
      .required(),
    parameters: Joi.object({
      startWithGui: Joi.boolean().optional(),
      useRL: Joi.boolean().optional(),
      rlModelPath: Joi.string().optional(),
      rlDelta: Joi.number().min(1).max(300).optional(),
    }).optional(),
  }),

  // TLS control
  tlsPhaseControl: Joi.object({
    tls_id: Joi.string().required(),
    action: Joi.string().valid('next', 'prev', 'set').required(),
    phaseIndex: Joi.number().min(0).when('action', {
      is: 'set',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  tlsStateControl: Joi.object({
    tls_id: Joi.string().required(),
    phase: Joi.string().required(),
  }),

  // Emergency
  createEmergency: Joi.object({
    vehicleId: Joi.string().required(),
    type: Joi.string().valid('ambulance', 'fire_truck', 'police', 'other').default('ambulance'),
    location: Joi.string().optional().allow(''),
    intersectionId: Joi.string().optional().allow(''),
    priority: Joi.string().valid('low', 'med', 'high', 'critical').default('high'),
    eta: Joi.string().optional().allow(''),
  }),

  // Settings
  updateSettings: Joi.object({
    sumo: Joi.object({
      stepLength: Joi.number().min(0.1).max(10).optional(),
      startWithGui: Joi.boolean().optional(),
      selectedConfig: Joi.string().optional(),
      configDir: Joi.string().optional(),
    }).optional(),
    adaptive: Joi.object({
      enabled: Joi.boolean().optional(),
      minGreen: Joi.number().min(1).max(60).optional(),
      maxGreen: Joi.number().min(10).max(300).optional(),
    }).optional(),
    emergency: Joi.object({
      priorityLevel: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
      defaultHandling: Joi.string().valid('forceGreen', 'clearRoute', 'notify').optional(),
    }).optional(),
  }),

  // Query parameters
  paginationQuery: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  dateRangeQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  }),
};

// Express-validator error handler for express-validator routes
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

module.exports = {
  validate,
  schemas,
  handleValidationErrors,
};
