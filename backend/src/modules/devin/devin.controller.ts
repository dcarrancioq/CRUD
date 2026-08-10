import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateDevinSessionDto } from './dto/create-devin-session.dto';
import { DevinService } from './devin.service';

@ApiTags('devin')
@Controller('integrations/devin')
export class DevinController {
  constructor(private readonly devin: DevinService) {}

  @Get('status')
  @ApiOperation({ summary: 'Indica si el backend tiene credenciales de Devin configuradas' })
  status() {
    return { configured: this.devin.isConfigured() };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Crea una sesion de Devin (el token de servicio se añade aqui, no en el navegador)' })
  createSession(@Body() dto: CreateDevinSessionDto) {
    return this.devin.createSession(dto);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Consulta el estado y la salida estructurada de una sesion' })
  getSession(@Param('sessionId') sessionId: string) {
    return this.devin.getSession(sessionId);
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Envia un mensaje de seguimiento a una sesion existente' })
  sendMessage(@Param('sessionId') sessionId: string, @Body('message') message: string) {
    return this.devin.sendMessage(sessionId, message);
  }
}
