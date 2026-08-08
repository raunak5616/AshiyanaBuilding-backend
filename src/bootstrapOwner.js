import mongoose from 'mongoose';
import { env } from './config/env.config.js';

import { Shop } from './models/shop.model.js';
import { User } from './models/user.model.js';
import { Role } from './models/role.model.js';
import { Permission } from './models/permission.model.js';
import { SystemSettings } from './models/systemSettings.model.js';
import { RefreshToken } from './models/refreshToken.model.js';

import { DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './modules/auth/auth.constants.js';

const bootstrap = async () => {
  try {
    const dbUri = env.MONGO_URI.endsWith('/') ? `${env.MONGO_URI}test` : env.MONGO_URI;
    console.log('Connecting to database:', dbUri);
    await mongoose.connect(dbUri);

    console.log('Clearing existing collections...');
    await Shop.deleteMany({});
    await User.deleteMany({});
    await Role.deleteMany({});
    await Permission.deleteMany({});
    await SystemSettings.deleteMany({});
    await RefreshToken.deleteMany({});

    console.log('1. Creating Shop...');
    const shop = await Shop.create({
      name: 'Aashiyana Building Materials',
      email: 'contact@aashiyana.com',
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

    console.log('2. Seeding Permissions...');
    const permissionDocs = [];
    for (const p of DEFAULT_PERMISSIONS) {
      const doc = await Permission.create({
        key: p.key,
        module: p.module,
        description: p.description,
      });
      permissionDocs.push(doc);
    }
    const permissionIdByKey = new Map(permissionDocs.map((p) => [p.key, p._id]));
    const allPermissionIds = permissionDocs.map((p) => p._id);

    console.log('3. Seeding Roles...');
    const createdRoles = [];
    for (const roleDef of DEFAULT_ROLES) {
      const permissionIds =
        roleDef.permissionKeys === null
          ? allPermissionIds
          : roleDef.permissionKeys.map((key) => permissionIdByKey.get(key));

      const role = await Role.create({
        shopId: shop._id,
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        permissions: permissionIds,
        isSystemDefault: true,
      });
      createdRoles.push(role);
    }
    const ownerRole = createdRoles.find((r) => r.slug === 'owner');

    console.log('4. Creating Owner user...');
    const owner = await User.create({
      shopId: shop._id,
      fullName: 'Aashiyana Owner',
      email: 'owner@aashiyana.com',
      phone: '9876543210',
      passwordHash: 'Password123!', // will be hashed automatically by user model's pre-save hook
      roleId: ownerRole._id,
      isOwner: true,
      isActive: true,
    });

    console.log('5. Linking Shop Owner...');
    shop.ownerId = owner._id;
    await shop.save();

    console.log('6. Creating System Settings...');
    await SystemSettings.create({
      shopId: shop._id,
    });

    console.log('✅ System Bootstrapped successfully WITHOUT transactions!');
    console.log('Owner email: owner@aashiyana.com');
    console.log('Password: Password123!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Bootstrapping failed:', error);
    process.exit(1);
  }
};

bootstrap();
