import mongoose from 'mongoose';
import { env } from './config/env.config.js';
import { Shop } from './models/shop.model.js';

const updateLocation = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    console.log('Connecting to database:', dbUri);
    await mongoose.connect(dbUri);

    console.log('Finding Shop...');
    const shop = await Shop.findOne({});
    if (!shop) {
      console.error('❌ No shop found in the database!');
      process.exit(1);
    }

    console.log('Current Shop Location:', shop.address);
    
    shop.address = {
      line1: 'Ahirauliā',
      line2: 'Plus Code VQFJ+5W',
      city: 'Pashchim Champaran',
      state: 'Bihar',
      pincode: '845452',
      country: 'India',
      latitude: 27.0859,
      longitude: 84.5887,
      plusCode: 'VQFJ+5W',
    };

    await shop.save();
    console.log('✅ Shop location successfully updated in database!');
    console.log('Updated Shop Location:', shop.address);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update shop location:', error);
    process.exit(1);
  }
};

updateLocation();
