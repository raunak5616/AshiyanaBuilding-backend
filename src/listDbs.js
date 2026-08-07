import mongoose from 'mongoose';
import { env } from './config/env.config.js';

const listDbs = async () => {
  try {
    const dbUri = env.MONGO_URI;
    console.log('Connecting to MongoDB server:', dbUri);
    
    // Connect to admin/default to list databases
    await mongoose.connect(dbUri);
    
    const adminDb = mongoose.connection.client.db().admin();
    const dbsInfo = await adminDb.listDatabases();
    
    console.log('\n--- Databases on Server ---');
    for (const dbInfo of dbsInfo.databases) {
      const dbName = dbInfo.name;
      // Skip system databases to focus on app data
      if (['admin', 'config', 'local'].includes(dbName)) continue;
      
      const dbConnection = mongoose.connection.client.db(dbName);
      const collections = await dbConnection.listCollections().toArray();
      
      console.log(`\nDatabase: ${dbName}`);
      if (collections.length === 0) {
        console.log('  No collections found.');
      } else {
        for (const col of collections) {
          const count = await dbConnection.collection(col.name).countDocuments({});
          console.log(`  - Collection: ${col.name}, Documents: ${count}`);
        }
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error listing databases:', error);
    process.exit(1);
  }
};

listDbs();
