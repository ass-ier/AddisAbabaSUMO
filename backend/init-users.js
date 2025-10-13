const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

// Import the User model
const User = require('./src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic_management';

async function initializeUsers() {
  let didConnect = false;
  try {
    // Use existing connection if available; otherwise connect
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI, {});
      didConnect = true;
      console.log('Connected to MongoDB');
    }

    // Helper to ensure a user exists; create if missing
    const ensureUser = async ({ username, password, email, firstName, lastName, role, region = 'Addis Ababa' }) => {
      const uname = String(username || '').toLowerCase();
      if (!uname || !password || !email || !firstName || !lastName || !role) {
        throw new Error(`Invalid user payload for ${username}`);
      }
      const existing = await User.findOne({ username: uname });
      if (existing) {
        console.log(`User already exists: ${existing.username} (role: ${existing.role})`);
        return existing;
      }
      // IMPORTANT: Do NOT pre-hash password here. Model pre-save hook will hash it.
      const user = new User({
        username: uname,
        email,
        password,
        firstName,
        lastName,
        role,
        region,
        isActive: true,
        isVerified: true,
      });
      await user.save();
      console.log(`✅ Created user: ${uname} / ${password} (role: ${role})`);
      return user;
    };

    // Ensure required users
    await ensureUser({
      username: 'admin',
      password: 'admin123',
      email: 'admin@trafficmanagement.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
    });

    await ensureUser({
      username: 'operatornew',
      password: 'operator123',
      email: 'operatornew@trafficmanagement.com',
      firstName: 'System',
      lastName: 'Operator',
      role: 'operator',
    });

    await ensureUser({
      username: 'analystnew',
      password: 'analyst123',
      email: 'analystnew@trafficmanagement.com',
      firstName: 'Traffic',
      lastName: 'Analyst',
      role: 'analyst',
    });

    console.log('✅ User initialization complete.');
  } catch (error) {
    console.error('❌ Error initializing users:', error);
  } finally {
    if (didConnect) {
      await mongoose.connection.close();
      console.log('Database connection closed');
    }
  }
}

module.exports = initializeUsers;

// If run directly (node init-users.js), execute and manage its own connection lifecycle
if (require.main === module) {
  initializeUsers();
}
