import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentStatus, OrderItem } from './entities/order.entity';
import { CartService } from '../cart/cart.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    private cartService: CartService,
  ) {}

  async create(userId: string, sessionId: string | undefined, createOrderDto: CreateOrderDto): Promise<Order> {
    const cartSummary = await this.cartService.getCartSummary(userId, sessionId);

    if (cartSummary.items.length === 0) {
      throw new BadRequestException('El carrito está vacío');
    }

    const orderNumber = this.generateOrderNumber();

    const order = this.ordersRepository.create({
      orderNumber,
      userId,
      items: cartSummary.items as OrderItem[],
      shippingAddress: createOrderDto.shippingAddress,
      billingAddress: createOrderDto.billingAddress || createOrderDto.shippingAddress,
      subtotal: cartSummary.subtotal,
      shippingCost: cartSummary.shipping,
      tax: cartSummary.tax,
      discount: cartSummary.discount,
      total: cartSummary.total,
      paymentMethod: createOrderDto.paymentMethod,
      shippingMethod: createOrderDto.shippingMethod,
      couponCode: cartSummary.couponCode,
      notes: createOrderDto.notes,
    });

        const savedOrder = await this.ordersRepository.save(order) as Order;
        await this.cartService.clearCart(userId, sessionId);

        return savedOrder;
  }

  async findAll(page = 1, limit = 10, status?: OrderStatus) {
    const queryBuilder = this.ordersRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      queryBuilder.where('order.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByUser(userId: string, page = 1, limit = 10) {
    const [data, total] = await this.ordersRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return order;
  }

  async findByOrderNumber(orderNumber: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { orderNumber },
      relations: ['user'],
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return order;
  }

  async updateStatus(id: string, updateDto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findById(id);
    order.status = updateDto.status;

    if (updateDto.trackingNumber) {
      order.trackingNumber = updateDto.trackingNumber;
    }

    if (updateDto.status === OrderStatus.SHIPPED) {
      order.shippedAt = new Date();
    } else if (updateDto.status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    }

    return this.ordersRepository.save(order);
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus, paymentId?: string): Promise<Order> {
    const order = await this.findById(id);
    order.paymentStatus = paymentStatus;
    if (paymentId) {
      order.paymentId = paymentId;
    }
    if (paymentStatus === PaymentStatus.PAID) {
      order.status = OrderStatus.CONFIRMED;
    }
    return this.ordersRepository.save(order);
  }

  async cancel(id: string): Promise<Order> {
    const order = await this.findById(id);
    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('No se puede cancelar un pedido enviado o entregado');
    }
    order.status = OrderStatus.CANCELLED;
    return this.ordersRepository.save(order);
  }

  async getStats() {
    const totalOrders = await this.ordersRepository.count();
    const pendingOrders = await this.ordersRepository.count({ where: { status: OrderStatus.PENDING } });
    const completedOrders = await this.ordersRepository.count({ where: { status: OrderStatus.DELIVERED } });

    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.total)', 'totalRevenue')
      .where('order.paymentStatus = :status', { status: PaymentStatus.PAID })
      .getRawOne();

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue: parseFloat(result?.totalRevenue || '0'),
    };
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }
}
