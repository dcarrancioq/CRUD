import { Controller, Get, Post, Put, Body, Param, Query, Headers, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderStatus } from './entities/order.entity';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los pedidos (admin)' })
  @ApiResponse({ status: 200, description: 'Lista de pedidos' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.findAll(page, limit, status);
  }

  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener pedidos del usuario actual' })
  @ApiResponse({ status: 200, description: 'Lista de pedidos del usuario' })
  async findMyOrders(
    @Request() req: { user: { id: string } },
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.ordersService.findByUser(req.user.id, page, limit);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de pedidos (admin)' })
  @ApiResponse({ status: 200, description: 'Estadísticas de pedidos' })
  async getStats() {
    return this.ordersService.getStats();
  }

  @Get('number/:orderNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener pedido por número' })
  @ApiResponse({ status: 200, description: 'Pedido encontrado' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  async findByOrderNumber(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.findByOrderNumber(orderNumber);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener pedido por ID' })
  @ApiResponse({ status: 200, description: 'Pedido encontrado' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nuevo pedido' })
  @ApiResponse({ status: 201, description: 'Pedido creado' })
  async create(
    @Request() req: { user: { id: string } },
    @Headers('x-session-id') sessionId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(req.user.id, sessionId, createOrderDto);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar estado del pedido (admin)' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  async updateStatus(@Param('id') id: string, @Body() updateDto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, updateDto);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar pedido' })
  @ApiResponse({ status: 200, description: 'Pedido cancelado' })
  async cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }
}
