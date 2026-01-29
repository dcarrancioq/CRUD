import { Controller, Get, Post, Put, Delete, Body, Param, Headers, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener carrito actual' })
  @ApiResponse({ status: 200, description: 'Carrito obtenido' })
  async getCart(@Headers('x-session-id') sessionId: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.cartService.getCart(userId, sessionId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen del carrito' })
  @ApiResponse({ status: 200, description: 'Resumen del carrito' })
  async getCartSummary(@Headers('x-session-id') sessionId: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.cartService.getCartSummary(userId, sessionId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Agregar producto al carrito' })
  @ApiResponse({ status: 201, description: 'Producto agregado' })
  async addItem(
    @Headers('x-session-id') sessionId: string,
    @Request() req: any,
    @Body() addToCartDto: AddToCartDto,
  ) {
    const userId = req.user?.id;
    return this.cartService.addItem(userId, sessionId, addToCartDto);
  }

  @Put('items/:productId')
  @ApiOperation({ summary: 'Actualizar cantidad de producto' })
  @ApiResponse({ status: 200, description: 'Cantidad actualizada' })
  async updateItem(
    @Headers('x-session-id') sessionId: string,
    @Request() req: any,
    @Param('productId') productId: string,
    @Body() updateDto: UpdateCartItemDto,
  ) {
    const userId = req.user?.id;
    return this.cartService.updateItem(userId, sessionId, productId, updateDto);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Eliminar producto del carrito' })
  @ApiResponse({ status: 200, description: 'Producto eliminado' })
  async removeItem(
    @Headers('x-session-id') sessionId: string,
    @Request() req: any,
    @Param('productId') productId: string,
  ) {
    const userId = req.user?.id;
    return this.cartService.removeItem(userId, sessionId, productId);
  }

  @Delete()
  @ApiOperation({ summary: 'Vaciar carrito' })
  @ApiResponse({ status: 200, description: 'Carrito vaciado' })
  async clearCart(@Headers('x-session-id') sessionId: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.cartService.clearCart(userId, sessionId);
  }

  @Post('coupon')
  @ApiOperation({ summary: 'Aplicar cupón de descuento' })
  @ApiResponse({ status: 200, description: 'Cupón aplicado' })
  async applyCoupon(
    @Headers('x-session-id') sessionId: string,
    @Request() req: any,
    @Body() applyCouponDto: ApplyCouponDto,
  ) {
    const userId = req.user?.id;
    return this.cartService.applyCoupon(userId, sessionId, applyCouponDto.code);
  }

  @Delete('coupon')
  @ApiOperation({ summary: 'Eliminar cupón de descuento' })
  @ApiResponse({ status: 200, description: 'Cupón eliminado' })
  async removeCoupon(@Headers('x-session-id') sessionId: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.cartService.removeCoupon(userId, sessionId);
  }
}
