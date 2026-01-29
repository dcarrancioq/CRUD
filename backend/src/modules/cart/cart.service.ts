import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem } from './entities/cart.entity';
import { ProductsService } from '../products/products.service';
import { CouponsService } from '../coupons/coupons.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    private productsService: ProductsService,
    private couponsService: CouponsService,
  ) {}

  async getOrCreateCart(userId?: string, sessionId?: string): Promise<Cart> {
    let cart: Cart | null = null;

    if (userId) {
      cart = await this.cartRepository.findOne({ where: { userId } });
    } else if (sessionId) {
      cart = await this.cartRepository.findOne({ where: { sessionId } });
    }

    if (!cart) {
      cart = this.cartRepository.create({
        userId,
        sessionId,
        items: [],
      });
      cart = await this.cartRepository.save(cart);
    }

    return cart;
  }

  async getCart(userId?: string, sessionId?: string): Promise<Cart> {
    return this.getOrCreateCart(userId, sessionId);
  }

  async addItem(userId: string | undefined, sessionId: string | undefined, addToCartDto: AddToCartDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const product = await this.productsService.findById(addToCartDto.productId);

    const stockCheck = await this.productsService.checkStock(addToCartDto.productId, addToCartDto.quantity);
    if (!stockCheck.available) {
      throw new BadRequestException('Stock insuficiente');
    }

    const existingItemIndex = cart.items.findIndex(
      item => item.productId === addToCartDto.productId && item.variantId === addToCartDto.variantId
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += addToCartDto.quantity;
      cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].unitPrice;
    } else {
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        productImage: product.images?.[0]?.url || '',
        sku: product.sku,
        variantId: addToCartDto.variantId,
        variantName: addToCartDto.variantName,
        quantity: addToCartDto.quantity,
        unitPrice: product.price,
        totalPrice: product.price * addToCartDto.quantity,
      };
      cart.items.push(newItem);
    }

    return this.cartRepository.save(cart);
  }

  async updateItem(userId: string | undefined, sessionId: string | undefined, productId: string, updateDto: UpdateCartItemDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    if (itemIndex < 0) {
      throw new NotFoundException('Producto no encontrado en el carrito');
    }

    if (updateDto.quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const stockCheck = await this.productsService.checkStock(productId, updateDto.quantity);
      if (!stockCheck.available) {
        throw new BadRequestException('Stock insuficiente');
      }
      cart.items[itemIndex].quantity = updateDto.quantity;
      cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * cart.items[itemIndex].unitPrice;
    }

    return this.cartRepository.save(cart);
  }

  async removeItem(userId: string | undefined, sessionId: string | undefined, productId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    if (itemIndex < 0) {
      throw new NotFoundException('Producto no encontrado en el carrito');
    }

    cart.items.splice(itemIndex, 1);
    return this.cartRepository.save(cart);
  }

  async clearCart(userId: string | undefined, sessionId: string | undefined): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId, sessionId);
    cart.items = [];
    cart.couponCode = null;
    cart.discount = 0;
    return this.cartRepository.save(cart);
  }

  async applyCoupon(userId: string | undefined, sessionId: string | undefined, couponCode: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const subtotal = this.calculateSubtotal(cart.items);

    const discount = await this.couponsService.validateAndCalculateDiscount(couponCode, subtotal);
    cart.couponCode = couponCode;
    cart.discount = discount;

    return this.cartRepository.save(cart);
  }

  async removeCoupon(userId: string | undefined, sessionId: string | undefined): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId, sessionId);
    cart.couponCode = null;
    cart.discount = 0;
    return this.cartRepository.save(cart);
  }

  async getCartSummary(userId: string | undefined, sessionId: string | undefined) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const subtotal = this.calculateSubtotal(cart.items);
    const shipping = subtotal >= 50 ? 0 : 4.99;
    const tax = subtotal * 0.21;
    const discount = cart.discount || 0;
    const total = subtotal + shipping + tax - discount;

    return {
      items: cart.items,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
      couponCode: cart.couponCode,
    };
  }

  private calculateSubtotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }
}
