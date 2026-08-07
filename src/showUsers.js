import mongoose from 'mongoose';
import { env } from './config/env.config.js';

const showUsers = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    console.log('Connecting to database:', dbUri);
    await mongoose.connect(dbUri);

    const db = mongoose.connection.db;

    // Check users
    const users = await db.collection('users').find({}).toArray();
    console.log('\n--- Staff / Owner Users (admin portal) ---');
    if (users.length === 0) {
      console.log('No staff/owner users found.');
    } else {
      users.forEach(u => {
        console.log(`- Name: ${u.fullName}, Email: ${u.email}, isOwner: ${u.isOwner}`);
      });
    }

    // Check customer users
    const customerUsers = await db.collection('customerusers').find({}).toArray();
    console.log('\n--- Customer Users (mobile app) ---');
    if (customerUsers.length === 0) {
      console.log('No customer users found.');
    } else {
      customerUsers.forEach(c => {
        console.log(`- Name: ${c.fullName}, Email: ${c.email}, Phone: ${c.phone}`);
      });
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error showing users:', error);
    process.exit(1);
  }
};

showUsers();
