import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiResponse({ status: 200, description: 'Lista de productos' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Obtener productos destacados' })
  async getFeatured(@Query('limit') limit = 8) {
    return this.productsService.getFeatured(limit);
  }

  @Get('new-arrivals')
  @ApiOperation({ summary: 'Obtener nuevos productos' })
  async getNewArrivals(@Query('limit') limit = 8) {
    return this.productsService.getNewArrivals(limit);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Obtener producto por slug' })
  @ApiResponse({ status: 200, description: 'Producto encontrado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiResponse({ status: 200, description: 'Producto encontrado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Get(':id/related')
  @ApiOperation({ summary: 'Obtener productos relacionados' })
  async getRelated(@Param('id') id: string, @Query('limit') limit = 4) {
    return this.productsService.getRelated(id, limit);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Obtener reseñas del producto' })
  async getReviews(@Param('id') id: string, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.productsService.getReviews(id, page, limit);
  }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Verificar stock del producto' })
  async checkStock(@Param('id') id: string, @Query('quantity') quantity = 1) {
    return this.productsService.checkStock(id, quantity);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear producto (admin)' })
  @ApiResponse({ status: 201, description: 'Producto creado' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear reseña del producto' })
  @ApiResponse({ status: 201, description: 'Reseña creada' })
  async createReview(
    @Param('id') id: string,
    @Request() req: { user: { id: string; email: string } },
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.productsService.createReview(id, req.user.id, req.user.email, createReviewDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar producto (admin)' })
  @ApiResponse({ status: 200, description: 'Producto actualizado' })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar producto (admin)' })
  @ApiResponse({ status: 200, description: 'Producto eliminado' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
