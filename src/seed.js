import mongoose from 'mongoose';
import { env } from './config/env.config.js';
import { Shop } from './models/shop.model.js';
import { Category } from './models/category.model.js';
import { Brand } from './models/brand.model.js';
import { Unit } from './models/unit.model.js';
import { Product } from './models/product.model.js';
import { Customer } from './models/customer.model.js';

const seed = async () => {
  try {
    console.log('Connecting to database...');
    // In our backend env.config, MONGO_URI is mongodb://localhost:27017/
    // We append the database name 'test' as used by the app collections
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    await mongoose.connect(dbUri);
    console.log('Connected to:', mongoose.connection.name);

    // 1. Create a Shop
    const shopId = new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b1c');
    await Shop.deleteMany({ _id: shopId });
    const shop = await Shop.create({
      _id: shopId,
      name: 'Ashiyana Building Materials',
      email: 'contact@ashiyana.com',
      phone: '9876543210',
      address: {
        line1: '12, Link Road',
        line2: 'Industrial Area',
        city: 'Ranchi',
        state: 'Jharkhand',
        pincode: '834001',
        country: 'India',
      },
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      isActive: true,
    });
    console.log('✅ Shop created:', shop.name, shop._id.toString());

    // 2. Create Category
    const categoryId = new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2c');
    await Category.deleteMany({ shopId });
    const category = await Category.create({
      _id: categoryId,
      shopId,
      name: 'Cement',
      slug: 'cement',
      isActive: true,
    });
    console.log('✅ Category created:', category.name);

    // 3. Create Brand
    const brandId = new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3c');
    await Brand.deleteMany({ shopId });
    const brand = await Brand.create({
      _id: brandId,
      shopId,
      name: 'Ultratech',
      isActive: true,
    });
    console.log('✅ Brand created:', brand.name);

    // 4. Create Unit
    const unitId = new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4c');
    await Unit.deleteMany({ shopId });
    const unit = await Unit.create({
      _id: unitId,
      shopId,
      name: 'Bag',
      abbreviation: 'BAG',
      isActive: true,
    });
    console.log('✅ Unit created:', unit.name);

    // 5. Create Product
    const productId = new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b5c');
    await Product.deleteMany({ shopId });
    const product = await Product.create({
      _id: productId,
      shopId,
      name: 'Ultratech Cement (Premium)',
      sku: 'ULTRA-CEM-001',
      barcode: '8901234567890',
      categoryId,
      brandId,
      unitId,
      description: 'Premium grade OPC cement for high strength construction.',
      purchasePrice: 35000, // 350.00 Rupees (in paise)
      sellingPrice: 42000, // 420.00 Rupees (in paise)
      taxRate: 18, // 18% GST
      isActive: true,
    });
    console.log('✅ Product created:', product.name, product._id.toString());

    // 6. Create an ERP Customer profile for quick-link tests
    await Customer.deleteMany({ shopId });
    const customer = await Customer.create({
      shopId,
      customerName: 'Demo Customer',
      customerCode: 'CUST-000001',
      customerType: 'individual',
      email: 'customer@example.com',
      phone: '9876543210',
      isActive: true,
    });
    console.log('✅ Customer profile created:', customer.customerName, customer.customerCode);

    console.log('🎉 Seeding completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
