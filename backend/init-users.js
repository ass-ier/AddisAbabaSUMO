const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './config.env' });

// Import the User model
const User = require('./src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic_management';

async function initializeUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {});
    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ username: 'admin' });
    if (existingSuperAdmin) {
      console.log('Super admin user already exists:', existingSuperAdmin.username);
      console.log('Role:', existingSuperAdmin.role);
      await mongoose.connection.close();
      return;
    }

    // Create super admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const superAdmin = new User({
      username: 'admin',
      email: 'admin@trafficmanagement.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      region: 'Addis Ababa',
      isActive: true,
      isVerified: true
    });

    await superAdmin.save();
    console.log('✅ Super admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Email: admin@trafficmanagement.com');
    console.log('Role: super_admin');

    // Create operator user
    const operatorPassword = await bcrypt.hash('operator123', 12);
    const operator = new User({
      username: 'operator',
      email: 'operator@trafficmanagement.com',
      password: operatorPassword,
      firstName: 'System',
      lastName: 'Operator',
      role: 'operator',
      region: 'Addis Ababa',
      isActive: true,
      isVerified: true
    });

    await operator.save();
    console.log('✅ Operator user created successfully!');
    console.log('Username: operator');
    console.log('Password: operator123');
    console.log('Role: operator');

    // Create analyst user
    const analystPassword = await bcrypt.hash('analyst123', 12);
    const analyst = new User({
      username: 'analyst',
      email: 'analyst@trafficmanagement.com',
      password: analystPassword,
      firstName: 'Traffic',
      lastName: 'Analyst',
      role: 'analyst',
      region: 'Addis Ababa',
      isActive: true,
      isVerified: true
    });

    await analyst.save();
    console.log('✅ Analyst user created successfully!');
    console.log('Username: analyst');
    console.log('Password: analyst123');
    console.log('Role: analyst');

  } catch (error) {
    console.error('❌ Error initializing users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the initialization
initializeUsers();