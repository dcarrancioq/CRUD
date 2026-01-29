import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart } from './entities/cart.entity';
import { ProductsModule } from '../products/products.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cart]), ProductsModule, CouponsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
