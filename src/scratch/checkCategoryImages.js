import mongoose from 'mongoose';
import { env } from '../config/env.config.js';
import { Category } from '../models/category.model.js';

const check = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    await mongoose.connect(dbUri);
    const categories = await Category.find({});
    console.log(`Found ${categories.length} categories:`);
    for (const c of categories) {
      console.log(`- Category: ${c.name}`);
      console.log(`  Slug: ${c.slug}`);
      console.log(`  Image: "${c.image}"`);
    }
    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};

check();
