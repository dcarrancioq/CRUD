import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los cupones (admin)' })
  @ApiResponse({ status: 200, description: 'Lista de cupones' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.couponsService.findAll(page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener cupón por ID (admin)' })
  @ApiResponse({ status: 200, description: 'Cupón encontrado' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  async findOne(@Param('id') id: string) {
    return this.couponsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear cupón (admin)' })
  @ApiResponse({ status: 201, description: 'Cupón creado' })
  async create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validar cupón y calcular descuento' })
  @ApiResponse({ status: 200, description: 'Cupón válido' })
  @ApiResponse({ status: 400, description: 'Cupón inválido' })
  async validate(@Body() validateCouponDto: ValidateCouponDto) {
    const discount = await this.couponsService.validateAndCalculateDiscount(
      validateCouponDto.code,
      validateCouponDto.subtotal,
    );
    return { valid: true, discount };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar cupón (admin)' })
  @ApiResponse({ status: 200, description: 'Cupón actualizado' })
  async update(@Param('id') id: string, @Body() updateCouponDto: UpdateCouponDto) {
    return this.couponsService.update(id, updateCouponDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar cupón (admin)' })
  @ApiResponse({ status: 200, description: 'Cupón eliminado' })
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
