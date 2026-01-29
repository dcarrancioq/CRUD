import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './modules/users/entities/user.entity';
import { Category } from './modules/categories/entities/category.entity';
import { Product, ProductStatus, StockStatus } from './modules/products/entities/product.entity';
import { Coupon, DiscountType } from './modules/coupons/entities/coupon.entity';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Starting seed...');

  const userRepository = dataSource.getRepository(User);
  const categoryRepository = dataSource.getRepository(Category);
  const productRepository = dataSource.getRepository(Product);
  const couponRepository = dataSource.getRepository(Coupon);

  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const userPassword = await bcrypt.hash('Usuario123!', 10);

  const admin = userRepository.create({
    email: 'admin@tienda.com',
    password: adminPassword,
    firstName: 'Admin',
    lastName: 'Sistema',
    role: UserRole.ADMIN,
    isActive: true,
    preferences: { newsletter: false, marketingEmails: false, orderNotifications: true, language: 'es', currency: 'EUR' },
  });

  const customer = userRepository.create({
    email: 'usuario@tienda.com',
    password: userPassword,
    firstName: 'Usuario',
    lastName: 'Prueba',
    role: UserRole.CUSTOMER,
    isActive: true,
    preferences: { newsletter: true, marketingEmails: true, orderNotifications: true, language: 'es', currency: 'EUR' },
  });

  await userRepository.save([admin, customer]);
  console.log('Users created');

  const electronics = categoryRepository.create({
    name: 'Electrónica',
    slug: 'electronica',
    description: 'Dispositivos electrónicos y gadgets',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400',
  });

  const clothing = categoryRepository.create({
    name: 'Ropa',
    slug: 'ropa',
    description: 'Moda y accesorios',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400',
  });

  const home = categoryRepository.create({
    name: 'Hogar',
    slug: 'hogar',
    description: 'Artículos para el hogar',
    image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400',
  });

  const sports = categoryRepository.create({
    name: 'Deportes',
    slug: 'deportes',
    description: 'Equipamiento deportivo',
    image: 'https://images.unsplash.com/photo-1461896836934-28e4b8f0e7b1?w=400',
  });

  await categoryRepository.save([electronics, clothing, home, sports]);
  console.log('Categories created');

  const defaultStock = {
    quantity: 50,
    lowStockThreshold: 10,
    trackInventory: true,
    allowBackorder: false,
    status: StockStatus.IN_STOCK,
  };

  const product1 = productRepository.create({
    sku: 'ELEC-001',
    name: 'Smartphone Pro Max',
    slug: 'smartphone-pro-max',
    description: 'El último smartphone con tecnología de punta. Pantalla AMOLED de 6.7 pulgadas, cámara de 108MP, batería de 5000mAh.',
    shortDescription: 'Smartphone de última generación',
    price: 999.99,
    compareAtPrice: 1199.99,
    currency: 'EUR',
    images: [],
    category: electronics,
    stock: { ...defaultStock, quantity: 50 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.5, count: 128, distribution: { 1: 5, 2: 8, 3: 15, 4: 40, 5: 60 } },
  });

  const product2 = productRepository.create({
    sku: 'ELEC-002',
    name: 'Laptop Ultrabook',
    slug: 'laptop-ultrabook',
    description: 'Laptop ultraligera con procesador de última generación. 16GB RAM, 512GB SSD, pantalla 4K.',
    shortDescription: 'Laptop potente y portátil',
    price: 1299.99,
    compareAtPrice: 1499.99,
    currency: 'EUR',
    images: [],
    category: electronics,
    stock: { ...defaultStock, quantity: 30 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.8, count: 89, distribution: { 1: 2, 2: 3, 3: 5, 4: 20, 5: 59 } },
  });

  const product3 = productRepository.create({
    sku: 'ELEC-003',
    name: 'Auriculares Bluetooth',
    slug: 'auriculares-bluetooth',
    description: 'Auriculares inalámbricos con cancelación de ruido activa. 30 horas de batería.',
    shortDescription: 'Auriculares premium inalámbricos',
    price: 249.99,
    compareAtPrice: 299.99,
    currency: 'EUR',
    images: [],
    category: electronics,
    stock: { ...defaultStock, quantity: 100 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.3, count: 256, distribution: { 1: 10, 2: 15, 3: 30, 4: 80, 5: 121 } },
  });

  const product4 = productRepository.create({
    sku: 'CLOTH-001',
    name: 'Camiseta Premium',
    slug: 'camiseta-premium',
    description: 'Camiseta de algodón orgánico 100%. Corte moderno y cómodo.',
    shortDescription: 'Camiseta de algodón orgánico',
    price: 29.99,
    compareAtPrice: 39.99,
    currency: 'EUR',
    images: [],
    category: clothing,
    stock: { ...defaultStock, quantity: 200 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.6, count: 342, distribution: { 1: 8, 2: 12, 3: 25, 4: 97, 5: 200 } },
  });

  const product5 = productRepository.create({
    sku: 'CLOTH-002',
    name: 'Jeans Slim Fit',
    slug: 'jeans-slim-fit',
    description: 'Jeans de corte slim con elastano para mayor comodidad. Lavado medio.',
    shortDescription: 'Jeans modernos y cómodos',
    price: 59.99,
    compareAtPrice: 79.99,
    currency: 'EUR',
    images: [],
    category: clothing,
    stock: { ...defaultStock, quantity: 150 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.4, count: 189, distribution: { 1: 5, 2: 10, 3: 20, 4: 64, 5: 90 } },
  });

  const product6 = productRepository.create({
    sku: 'HOME-001',
    name: 'Lámpara de Mesa LED',
    slug: 'lampara-mesa-led',
    description: 'Lámpara de mesa con luz LED regulable. Diseño minimalista y elegante.',
    shortDescription: 'Lámpara LED moderna',
    price: 49.99,
    compareAtPrice: 69.99,
    currency: 'EUR',
    images: [],
    category: home,
    stock: { ...defaultStock, quantity: 75 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.2, count: 67, distribution: { 1: 3, 2: 5, 3: 10, 4: 24, 5: 25 } },
  });

  const product7 = productRepository.create({
    sku: 'HOME-002',
    name: 'Set de Sábanas Premium',
    slug: 'set-sabanas-premium',
    description: 'Set de sábanas de algodón egipcio 400 hilos. Incluye sábana bajera, encimera y fundas.',
    shortDescription: 'Sábanas de algodón egipcio',
    price: 89.99,
    compareAtPrice: 119.99,
    currency: 'EUR',
    images: [],
    category: home,
    stock: { ...defaultStock, quantity: 40 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.7, count: 156, distribution: { 1: 3, 2: 5, 3: 12, 4: 36, 5: 100 } },
  });

  const product8 = productRepository.create({
    sku: 'SPORT-001',
    name: 'Zapatillas Running Pro',
    slug: 'zapatillas-running-pro',
    description: 'Zapatillas de running con tecnología de amortiguación avanzada. Ideales para largas distancias.',
    shortDescription: 'Zapatillas de running profesionales',
    price: 129.99,
    compareAtPrice: 159.99,
    currency: 'EUR',
    images: [],
    category: sports,
    stock: { ...defaultStock, quantity: 60 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.9, count: 423, distribution: { 1: 5, 2: 8, 3: 15, 4: 45, 5: 350 } },
  });

  const product9 = productRepository.create({
    sku: 'SPORT-002',
    name: 'Mancuernas Ajustables',
    slug: 'mancuernas-ajustables',
    description: 'Set de mancuernas ajustables de 2.5kg a 25kg. Sistema de ajuste rápido.',
    shortDescription: 'Mancuernas de peso variable',
    price: 199.99,
    compareAtPrice: 249.99,
    currency: 'EUR',
    images: [],
    category: sports,
    stock: { ...defaultStock, quantity: 25 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.6, count: 78, distribution: { 1: 2, 2: 3, 3: 8, 4: 20, 5: 45 } },
  });

  const product10 = productRepository.create({
    sku: 'ELEC-004',
    name: 'Smartwatch Fitness',
    slug: 'smartwatch-fitness',
    description: 'Reloj inteligente con monitor de ritmo cardíaco, GPS y resistencia al agua.',
    shortDescription: 'Smartwatch deportivo',
    price: 179.99,
    compareAtPrice: 219.99,
    currency: 'EUR',
    images: [],
    category: electronics,
    stock: { ...defaultStock, quantity: 80 },
    status: ProductStatus.ACTIVE,
    ratings: { average: 4.4, count: 312, distribution: { 1: 12, 2: 18, 3: 35, 4: 97, 5: 150 } },
  });

  await productRepository.save([product1, product2, product3, product4, product5, product6, product7, product8, product9, product10]);
  console.log('Products created');

  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const coupon1 = couponRepository.create({
    code: 'BIENVENIDO10',
    description: '10% de descuento para nuevos usuarios',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    minPurchase: 50,
    maxDiscount: 50,
    usageLimit: 1000,
    isActive: true,
    startsAt: now,
    expiresAt: nextYear,
  });

  const coupon2 = couponRepository.create({
    code: 'ENVIOGRATIS',
    description: 'Envío gratis en pedidos superiores a 30€',
    discountType: DiscountType.FIXED,
    discountValue: 4.99,
    minPurchase: 30,
    usageLimit: 500,
    isActive: true,
    startsAt: now,
    expiresAt: nextMonth,
  });

  const coupon3 = couponRepository.create({
    code: 'VERANO25',
    description: '25% de descuento en toda la tienda',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 25,
    minPurchase: 100,
    maxDiscount: 100,
    usageLimit: 200,
    isActive: true,
    startsAt: now,
    expiresAt: nextMonth,
  });

  await couponRepository.save([coupon1, coupon2, coupon3]);
  console.log('Coupons created');

  console.log('Seed completed successfully!');
  await app.close();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
