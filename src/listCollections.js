import mongoose from 'mongoose';
import { env } from './config/env.config.js';

const listCollections = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    console.log('Connecting to database:', dbUri);
    await mongoose.connect(dbUri);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('\n--- Collections and Document Counts ---');
    if (collections.length === 0) {
      console.log('No collections found in this database.');
    } else {
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments({});
        console.log(`- Collection: ${col.name}, Document Count: ${count}`);
        if (count > 0) {
          const sample = await db.collection(col.name).findOne({});
          console.log(`  Sample Document Keys:`, Object.keys(sample));
        }
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error listing collections:', error);
    process.exit(1);
  }
};

listCollections();
