/**
 * Script to create or reset admin users.
 * Run with: node scripts/createAdmin.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mzansi-prolife';

const adminUsers = [
  {
    name: 'Admin User',
    email: 'admin@mzansiprolife.org',
    phone: '079 822 2269',
    password: 'Admin@2024!',
    role: 'admin',
  },
  {
    name: 'System Administrator',
    email: 'system@mzansiprolife.org',
    phone: '078 081 3955',
    password: 'System@2024!',
    role: 'admin',
  },
];

async function createAdminUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const adminData of adminUsers) {
      try {
        const existingUser = await User.findOne({ email: adminData.email }).select('+password');

        if (existingUser) {
          // Keep password plain here; User model pre-save hook hashes it once.
          existingUser.name = adminData.name;
          existingUser.phone = adminData.phone;
          existingUser.role = 'admin';
          existingUser.isEmailVerified = true;
          existingUser.password = adminData.password;
          await existingUser.save();

          console.log(`Updated admin user: ${adminData.email}`);
          console.log(`Password reset to: ${adminData.password}`);
        } else {
          await User.create({
            name: adminData.name,
            email: adminData.email,
            phone: adminData.phone,
            password: adminData.password,
            role: 'admin',
            isEmailVerified: true,
          });

          console.log(`Created admin user: ${adminData.email}`);
          console.log(`Password: ${adminData.password}`);
        }
      } catch (error) {
        console.error(`Error creating admin ${adminData.email}:`, error.message);
      }
    }

    console.log('\nAdmin user creation/reset completed.');
    console.log('IMPORTANT: Change default passwords after first login.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

createAdminUsers();
