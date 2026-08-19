import mongoose from 'mongoose';
import { env } from '../config/env.config.js';
import { Product } from '../models/product.model.js';

const check = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    await mongoose.connect(dbUri);
    const products = await Product.find({});
    console.log(`Found ${products.length} products:`);
    for (const p of products) {
      console.log(`- Product: ${p.name}`);
      console.log(`  SKU: ${p.sku}`);
      console.log(`  Images:`, p.images);
    }
    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};

check();
