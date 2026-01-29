import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Coupon, DiscountType } from './entities/coupon.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponsRepository: Repository<Coupon>,
  ) {}

  async create(createCouponDto: CreateCouponDto): Promise<Coupon> {
    const existingCoupon = await this.couponsRepository.findOne({
      where: { code: createCouponDto.code.toUpperCase() },
    });
    if (existingCoupon) {
      throw new BadRequestException('El código de cupón ya existe');
    }

    const coupon = this.couponsRepository.create({
      ...createCouponDto,
      code: createCouponDto.code.toUpperCase(),
    });
    return this.couponsRepository.save(coupon);
  }

  async findAll(page = 1, limit = 10) {
    const [data, total] = await this.couponsRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Coupon> {
    const coupon = await this.couponsRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Cupón no encontrado');
    }
    return coupon;
  }

  async findByCode(code: string): Promise<Coupon> {
    const coupon = await this.couponsRepository.findOne({
      where: { code: code.toUpperCase() },
    });
    if (!coupon) {
      throw new NotFoundException('Cupón no encontrado');
    }
    return coupon;
  }

  async update(id: string, updateCouponDto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.findById(id);
    Object.assign(coupon, updateCouponDto);
    if (updateCouponDto.code) {
      coupon.code = updateCouponDto.code.toUpperCase();
    }
    return this.couponsRepository.save(coupon);
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.findById(id);
    await this.couponsRepository.remove(coupon);
  }

  async validateAndCalculateDiscount(code: string, subtotal: number): Promise<number> {
    const coupon = await this.findByCode(code);
    const now = new Date();

    if (!coupon.isActive) {
      throw new BadRequestException('El cupón no está activo');
    }

    if (now < coupon.startsAt) {
      throw new BadRequestException('El cupón aún no es válido');
    }

    if (now > coupon.expiresAt) {
      throw new BadRequestException('El cupón ha expirado');
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('El cupón ha alcanzado su límite de uso');
    }

    if (subtotal < coupon.minPurchase) {
      throw new BadRequestException(`El pedido mínimo para este cupón es ${coupon.minPurchase}€`);
    }

    let discount: number;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
    }

    return Math.round(discount * 100) / 100;
  }

  async incrementUsage(code: string): Promise<void> {
    const coupon = await this.findByCode(code);
    coupon.usageCount += 1;
    await this.couponsRepository.save(coupon);
  }
}
