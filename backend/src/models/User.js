const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema - Supports different user roles in the traffic management system
 * Roles:
 * - super_admin: Full system control
 * - admin: Administrative functions
 * - system_operator: Traffic control operations
 * - user: Basic user access
 */
const UserSchema = new mongoose.Schema({
  // Basic user information
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  // User profile
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  
  // Role and permissions
  role: {
    type: String,
    enum: ['operator', 'analyst', 'super_admin'],
    default: 'operator',
    required: true
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Authentication tracking
  lastLogin: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional metadata (optional region/area of operation)
  region: {
    type: String,
    trim: true,
    maxlength: [100, 'Region cannot exceed 100 characters'],
    default: ''
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  
  // System metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Security: require user to change password after admin reset
  forcePasswordChange: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: {
    transform: function(doc, ret) {
      // Remove password from JSON output
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance (username and email already have unique indexes from schema definition)
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save middleware to normalize username and hash password
UserSchema.pre('save', async function(next) {
  // Normalize username to lowercase
  if (this.isModified('username')) {
    this.username = this.username.toLowerCase();
  }
  
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update passwordChangedAt
UserSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Instance method to check password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if password was changed after JWT was issued
UserSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method to get full name
UserSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Static method to find by username
UserSchema.statics.findByUsername = function(username, includePassword = false) {
  const query = this.findOne({ username: username.toLowerCase() });
  if (!includePassword) {
    query.select('-password');
  }
  return query;
};

// Static method to find active users
UserSchema.statics.findActive = function() {
  return this.find({ isActive: true }).select('-password');
};

// Static method to find by role
UserSchema.statics.findByRole = function(role, activeOnly = true) {
  const query = { role };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).select('-password');
};

// Virtual for user's display name
UserSchema.virtual('displayName').get(function() {
  return this.getFullName();
});

// Clear any cached model to ensure schema changes are applied
if (mongoose.models.User) {
  delete mongoose.models.User;
  delete mongoose.connection.models.User;
}

module.exports = mongoose.model('User', UserSchema);
