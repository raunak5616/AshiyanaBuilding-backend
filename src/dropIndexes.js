import mongoose from 'mongoose';
import { env } from './config/env.config.js';

const dropIndexes = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    console.log('Connecting to database:', dbUri);
    await mongoose.connect(dbUri);
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'customers' }).toArray();
    
    if (collections.length > 0) {
      console.log('Found customers collection. Listing indexes...');
      const indexes = await db.collection('customers').listIndexes().toArray();
      console.log('Current indexes:', indexes.map(idx => idx.name));

      const oldIndexesToDrop = [
        'shopId_1_gstNumber_1',
        'shopId_1_panNumber_1',
        'shopId_1_phone_1'
      ];

      for (const idxName of oldIndexesToDrop) {
        if (indexes.some(idx => idx.name === idxName)) {
          console.log(`Dropping index: ${idxName}...`);
          await db.collection('customers').dropIndex(idxName);
          console.log(`Successfully dropped ${idxName}`);
        } else {
          console.log(`Index ${idxName} does not exist, skipping.`);
        }
      }
    } else {
      console.log('customers collection does not exist.');
    }

    console.log('Done!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error dropping indexes:', error);
    process.exit(1);
  }
};

dropIndexes();
