import mongoose from 'mongoose';
import { env } from './config/env.config.js';

// Import models to register schemas
import { Customer } from './models/customer.model.js';
import { CustomerUser } from './models/customerUser.model.js';
import { Shop } from './models/shop.model.js';
import { User } from './models/user.model.js';

const syncIndexes = async () => {
  try {
    const dbUri = env.MONGO_URI;
    console.log('Connecting to database:', dbUri);
    await mongoose.connect(dbUri);
    
    console.log('Synchronizing indexes...');
    
    console.log('Syncing Customer model indexes...');
    await Customer.syncIndexes();
    
    console.log('Syncing CustomerUser model indexes...');
    await CustomerUser.syncIndexes();

    console.log('Listing current Customer collection indexes:');
    const indexes = await mongoose.connection.db.collection('customers').listIndexes().toArray();
    console.log(JSON.stringify(indexes, null, 2));

    console.log('Successfully synchronized all indexes!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error synchronizing indexes:', error);
    process.exit(1);
  }
};

syncIndexes();
