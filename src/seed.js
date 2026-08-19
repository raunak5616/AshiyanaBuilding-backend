import mongoose from 'mongoose';
import { env } from './config/env.config.js';
import { Shop } from './models/shop.model.js';
import { Category } from './models/category.model.js';
import { Brand } from './models/brand.model.js';
import { Unit } from './models/unit.model.js';
import { Product } from './models/product.model.js';
import { Customer } from './models/customer.model.js';
import { CustomerCart } from './models/customerCart.model.js';

const seed = async () => {
  try {
    console.log('Connecting to database...');
    // In our backend env.config, MONGO_URI is mongodb://localhost:27017/
    // We append the database name 'test' as used by the app collections
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    await mongoose.connect(dbUri);
    console.log('Connected to:', mongoose.connection.name);

    // 1. Find the existing Shop (created by bootstrapOwner.js)
    let shop = await Shop.findOne({});
    if (!shop) {
      console.log('No shop found. Creating a default shop...');
      shop = await Shop.create({
        name: 'Ashiyana Building Materials',
        email: 'contact@ashiyana.com',
        phone: '9876543210',
        address: {
          line1: 'Ahirauliā',
          line2: 'Plus Code VQFJ+5W',
          city: 'Pashchim Champaran',
          state: 'Bihar',
          pincode: '845452',
          country: 'India',
          latitude: 27.0859,
          longitude: 84.5887,
          plusCode: 'VQFJ+5W',
        },
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        isActive: true,
      });
    }
    const shopId = shop._id;
    console.log('✅ Using Shop:', shop.name, shopId.toString());

    // Clear out old customer carts to avoid orphaned document/index errors
    await CustomerCart.deleteMany({});

    // 2. Create Categories
    await Category.deleteMany({});
    const categories = [
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2c'),
        shopId,
        name: 'Cement',
        slug: 'cement',
        image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2d'),
        shopId,
        name: 'Tiling',
        slug: 'tiling',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2e'),
        shopId,
        name: 'Painting',
        slug: 'painting',
        image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2f'),
        shopId,
        name: 'Water Proofing',
        slug: 'water-proofing',
        image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b20'),
        shopId,
        name: 'Plywood & MDF',
        slug: 'plywood-mdf',
        image: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b21'),
        shopId,
        name: 'Wires & Cables',
        slug: 'wires-cables',
        image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b22'),
        shopId,
        name: 'Switches & Sockets',
        slug: 'switches-sockets',
        image: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b23'),
        shopId,
        name: 'Door Locks',
        slug: 'door-locks',
        image: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b24'),
        shopId,
        name: 'CPVC Pipes',
        slug: 'cpvc-pipes',
        image: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=250',
        isActive: true,
      },
    ];
    await Category.create(categories);
    console.log('✅ Categories seeded');

    // 3. Create Brands
    await Brand.deleteMany({});
    const brands = [
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3c'), shopId, name: 'Ultratech', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3d'), shopId, name: 'Ambuja', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3e'), shopId, name: 'Kajaria', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3f'), shopId, name: 'Asian Paints', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b30'), shopId, name: 'Dr. Fixit', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b31'), shopId, name: 'CenturyPly', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b32'), shopId, name: 'Polycab', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b33'), shopId, name: 'Finolex', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b34'), shopId, name: 'Havells', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b35'), shopId, name: 'Godrej', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b36'), shopId, name: 'Astral', isActive: true },
    ];
    await Brand.create(brands);
    console.log('✅ Brands seeded');

    // 4. Create Units
    await Unit.deleteMany({});
    const units = [
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4c'), shopId, name: 'Bag', abbreviation: 'BAG', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4d'), shopId, name: 'Box', abbreviation: 'BOX', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4e'), shopId, name: 'Piece', abbreviation: 'PCS', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4f'), shopId, name: 'Litre', abbreviation: 'LTR', isActive: true },
      { _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b40'), shopId, name: 'Coil', abbreviation: 'COIL', isActive: true },
    ];
    await Unit.create(units);
    console.log('✅ Units seeded');

    // 5. Create Products
    await Product.deleteMany({});
    const products = [
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b5c'),
        shopId,
        name: 'Ultratech Cement (OPC 53)',
        sku: 'ULTRA-OPC-53',
        barcode: '8901234567890',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2c'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3c'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4c'),
        description: 'OPC 53 grade cement for high-strength foundations and structural building.',
        purchasePrice: 38000,
        sellingPrice: 44000, // Rs. 440
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=400', publicId: 'seed/ultra_cem' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b5d'),
        shopId,
        name: 'Ambuja Kawach Cement',
        sku: 'AMBUJA-KAWACH',
        barcode: '8901234567891',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2c'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3d'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4c'),
        description: 'Specially formulated water-repellent cement for damp prevention.',
        purchasePrice: 39000,
        sellingPrice: 46000, // Rs. 460
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400', publicId: 'seed/ambuja_cem' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b5e'),
        shopId,
        name: 'Kajaria Ceramic Floor Tiles',
        sku: 'KAJARIA-CER-600',
        barcode: '8901234567892',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2d'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3e'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4d'),
        description: 'High-quality Kajaria vitrified floor tiles (600x600 mm) with gloss finish.',
        purchasePrice: 65000,
        sellingPrice: 78000, // Rs. 780
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400', publicId: 'seed/kaj_tile' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b5f'),
        shopId,
        name: 'Asian Paints Apex Exterior',
        sku: 'ASIAN-APEX-20L',
        barcode: '8901234567893',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2e'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b3f'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4f'),
        description: 'Apex weather-proof exterior emulsion white (20 Litre bucket).',
        purchasePrice: 420000,
        sellingPrice: 495000, // Rs. 4,950
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&q=80&w=400', publicId: 'seed/ap_apex' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b60'),
        shopId,
        name: 'Dr. Fixit LW+ Waterproofing',
        sku: 'DFIXIT-LW-5L',
        barcode: '8901234567894',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b2f'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b30'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4f'),
        description: 'Waterproofing liquid additive for concrete mixes (5 Litres).',
        purchasePrice: 65000,
        sellingPrice: 82000, // Rs. 820
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400', publicId: 'seed/fixit_lw' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b61'),
        shopId,
        name: 'CenturyPly Club Prime Plywood',
        sku: 'CPLY-CLUB-19MM',
        barcode: '8901234567895',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b20'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b31'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4e'),
        description: 'CenturyPly water-proof Club Prime grade boiling water resistant plywood (19mm).',
        purchasePrice: 120000,
        sellingPrice: 145000, // Rs. 1,450
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=400', publicId: 'seed/cply_ply' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b62'),
        shopId,
        name: 'Polycab Maxima+ 1.5 Sqmm Wire',
        sku: 'POLYCAB-MAX-1.5',
        barcode: '8901234567896',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b21'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b32'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b40'),
        description: 'Polycab single core copper wire HR FR-LSH 90m roll (Green).',
        purchasePrice: 210000,
        sellingPrice: 245000, // Rs. 2,450
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&q=80&w=400', publicId: 'seed/poly_wire' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b63'),
        shopId,
        name: 'Havells Crabtree 1-Way Switch',
        sku: 'HAVELLS-CRAB-1W',
        barcode: '8901234567897',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b22'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b34'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4e'),
        description: 'Modular wall light/fan control switch Crabtree series (White).',
        purchasePrice: 6500,
        sellingPrice: 8500, // Rs. 85
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=400', publicId: 'seed/hav_switch' }],
        isActive: true,
      },
      {
        _id: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b64'),
        shopId,
        name: 'Godrej Ultra XL Door Lock',
        sku: 'GODREJ-ULTRA-XL',
        barcode: '8901234567898',
        categoryId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b23'),
        brandId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b35'),
        unitId: new mongoose.Types.ObjectId('60b9f15c7c2b5d4e6f8a9b4e'),
        description: 'Godrej double stroke high security main door lock with keys.',
        purchasePrice: 145000,
        sellingPrice: 175000, // Rs. 1,750
        taxRate: 18,
        images: [{ url: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&q=80&w=400', publicId: 'seed/god_lock' }],
        isActive: true,
      },
    ];
    await Product.create(products);
    console.log('✅ Products seeded');

    // Find all linked customer IDs in customerusers to avoid deleting registered app users
    const customerUsersCol = mongoose.connection.db.collection('customerusers');
    const appUsers = await customerUsersCol.find({ shopId }).toArray();
    const linkedCustomerIds = appUsers.map(u => u.customerId).filter(Boolean);

    // Delete only customers that are NOT linked to any app user
    await Customer.deleteMany({ 
      shopId, 
      _id: { $nin: linkedCustomerIds } 
    });

    const customerExists = await Customer.findOne({ shopId, customerCode: 'CUST-000001' });
    if (!customerExists) {
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
    } else {
      console.log('✅ Demo Customer profile already exists, skipping creation');
    }

    console.log('🎉 Seeding completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
