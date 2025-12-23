/**
 * Script to create admin users
 * Run with: node scripts/createAdmin.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mzansi-prolife';

// Admin users to create
const adminUsers = [
  {
    name: 'Admin User',
    email: 'admin@mzansiprolife.org',
    phone: '079 822 2269',
    password: 'Admin@2024!', // Change this password after first login
    role: 'admin'
  },
  {
    name: 'System Administrator',
    email: 'system@mzansiprolife.org',
    phone: '078 081 3955',
    password: 'System@2024!', // Change this password after first login
    role: 'admin'
  }
];

async function createAdminUsers() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create admin users
    for (const adminData of adminUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: adminData.email });
        
        if (existingUser) {
          // Update existing user to admin if not already
          if (existingUser.role !== 'admin') {
            existingUser.role = 'admin';
            await existingUser.save();
            console.log(`✅ Updated user ${adminData.email} to admin role`);
          } else {
            console.log(`ℹ️  User ${adminData.email} already exists as admin`);
          }
        } else {
          // Create new admin user
          const hashedPassword = await bcrypt.hash(adminData.password, 10);
          const admin = await User.create({
            name: adminData.name,
            email: adminData.email,
            phone: adminData.phone,
            password: hashedPassword,
            role: 'admin',
            isEmailVerified: true
          });
          console.log(`✅ Created admin user: ${adminData.email}`);
          console.log(`   Name: ${adminData.name}`);
          console.log(`   Email: ${adminData.email}`);
          console.log(`   Password: ${adminData.password}`);
        }
      } catch (error) {
        console.error(`❌ Error creating admin ${adminData.email}:`, error.message);
      }
    }

    console.log('\n✅ Admin user creation completed!');
    console.log('\n📝 IMPORTANT: Change the default passwords after first login!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the script
createAdminUsers();

