import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Product, ProductStatus, StockStatus } from './entities/product.entity';
import { Review } from './entities/review.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Review)
    private reviewsRepository: Repository<Review>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create({
      ...createProductDto,
      stock: {
        quantity: createProductDto.stockQuantity || 0,
        lowStockThreshold: 10,
        trackInventory: true,
        allowBackorder: false,
        status: this.calculateStockStatus(createProductDto.stockQuantity || 0),
      },
      ratings: { average: 0, count: 0, distribution: {} },
    });
    return this.productsRepository.save(product);
  }

  async findAll(query: ProductQueryDto) {
    const { page = 1, limit = 10, category, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'DESC', search, inStock } = query;

    const queryBuilder = this.productsRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.status = :status', { status: ProductStatus.ACTIVE });

    if (category) {
      queryBuilder.andWhere('product.categoryId = :category', { category });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    if (search) {
      queryBuilder.andWhere('(product.name ILIKE :search OR product.description ILIKE :search)', { search: `%${search}%` });
    }

    if (inStock) {
      queryBuilder.andWhere("product.stock->>'status' = :stockStatus", { stockStatus: StockStatus.IN_STOCK });
    }

    const validSortFields = ['price', 'name', 'createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`product.${sortField}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { slug },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);
    Object.assign(product, updateProductDto);
    if (updateProductDto.stockQuantity !== undefined) {
      product.stock = {
        ...product.stock,
        quantity: updateProductDto.stockQuantity,
        status: this.calculateStockStatus(updateProductDto.stockQuantity),
      };
    }
    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findById(id);
    await this.productsRepository.remove(product);
  }

  async getFeatured(limit = 8): Promise<Product[]> {
    return this.productsRepository.find({
      where: { status: ProductStatus.ACTIVE },
      relations: ['category'],
      order: { ratings: { average: 'DESC' } },
      take: limit,
    });
  }

  async getNewArrivals(limit = 8): Promise<Product[]> {
    return this.productsRepository.find({
      where: { status: ProductStatus.ACTIVE },
      relations: ['category'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRelated(productId: string, limit = 4): Promise<Product[]> {
    const product = await this.findById(productId);
    return this.productsRepository.find({
      where: { categoryId: product.categoryId, status: ProductStatus.ACTIVE },
      relations: ['category'],
      take: limit + 1,
    }).then(products => products.filter(p => p.id !== productId).slice(0, limit));
  }

  async getReviews(productId: string, page = 1, limit = 10) {
    const [data, total] = await this.reviewsRepository.findAndCount({
      where: { productId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createReview(productId: string, userId: string, userName: string, createReviewDto: CreateReviewDto): Promise<Review> {
    const product = await this.findById(productId);
    const review = this.reviewsRepository.create({
      ...createReviewDto,
      productId,
      userId,
      userName,
    });
    const savedReview = await this.reviewsRepository.save(review);

    const reviews = await this.reviewsRepository.find({ where: { productId } });
    const count = reviews.length;
    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / count;
    const distribution: { [key: number]: number } = {};
    reviews.forEach(r => {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    });

    product.ratings = { average: Math.round(average * 10) / 10, count, distribution };
    await this.productsRepository.save(product);

    return savedReview;
  }

  async checkStock(productId: string, quantity = 1): Promise<{ available: boolean; stock: number }> {
    const product = await this.findById(productId);
    const stockQuantity = product.stock?.quantity || 0;
    return {
      available: stockQuantity >= quantity,
      stock: stockQuantity,
    };
  }

  private calculateStockStatus(quantity: number): StockStatus {
    if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
    if (quantity <= 10) return StockStatus.LOW_STOCK;
    return StockStatus.IN_STOCK;
  }
}
