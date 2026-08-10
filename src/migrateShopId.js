import mongoose from 'mongoose';
import { env } from './config/env.config.js';

const migrate = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    console.log('Connecting to database:', dbUri);
    await mongoose.connect(dbUri);
    const db = mongoose.connection.db;

    const oldShopId = new mongoose.Types.ObjectId('6a7720f10dfd61f878ce6810');
    const newShopId = new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b1c');

    const collections = [
      'users',
      'roles',
      'systemsettings',
      'products',
      'categories',
      'brands',
      'units',
      'customerusers',
      'customers',
      'sales',
      'purchases',
      'suppliers'
    ];

    for (const colName of collections) {
      const col = db.collection(colName);
      
      // Update ObjectId shopId values
      const resObj = await col.updateMany({ shopId: oldShopId }, { $set: { shopId: newShopId } });
      console.log(`Updated ${resObj.modifiedCount} ObjectId documents in '${colName}'`);

      // Update String shopId values just in case
      const resStr = await col.updateMany({ shopId: '6a7720f10dfd61f878ce6810' }, { $set: { shopId: '60b9f15c7c2b5d4e6f8a9b1c' } });
      console.log(`Updated ${resStr.modifiedCount} String-based documents in '${colName}'`);
    }

    console.log('🎉 Migration completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
