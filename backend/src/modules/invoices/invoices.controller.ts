import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateDevinSessionDto } from '../devin/dto/create-devin-session.dto';
import { DevinService } from '../devin/devin.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ResolveExceptionDto } from './dto/resolve-exception.dto';
import { toInvoiceResponse } from './invoice.mapper';
import { InvoicesService } from './services/invoices.service';

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly devin: DevinService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado de facturas con clasificacion, riesgo y excepciones' })
  async findAll() {
    const invoices = await this.invoices.findAll();
    return invoices.map(toInvoiceResponse);
  }

  @Get('exceptions')
  @ApiOperation({ summary: 'Cola de excepciones abiertas o en revision (lo unico que se revisa a mano)' })
  findOpenExceptions() {
    return this.invoices.findOpenExceptions();
  }

  @Get('consolidation-opportunities')
  @ApiOperation({ summary: 'Categorias con varios proveedores y ahorro estimado por consolidacion' })
  findConsolidationOpportunities() {
    return this.invoices.findConsolidationOpportunities();
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compara dos facturas campo a campo y puntua la similitud de duplicado' })
  @ApiQuery({ name: 'left', required: true })
  @ApiQuery({ name: 'right', required: true })
  async compare(@Query('left') left: string, @Query('right') right: string) {
    const comparison = await this.invoices.compare(left, right);
    return {
      ...comparison,
      left: toInvoiceResponse(comparison.left),
      right: toInvoiceResponse(comparison.right),
    };
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Evalua tolerancias, clasificacion y riesgo sin registrar la factura',
    description: 'Alimenta el panel en vivo de la pantalla de alta.',
  })
  async preview(@Body() dto: CreateInvoiceDto) {
    return toInvoiceResponse(await this.invoices.preview(dto));
  }

  @Post()
  @ApiOperation({ summary: 'Registra la factura y persiste el resultado de los controles' })
  async create(@Body() dto: CreateInvoiceDto) {
    return toInvoiceResponse(await this.invoices.create(dto));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una factura' })
  async findOne(@Param('id') id: string) {
    return toInvoiceResponse(await this.invoices.findOne(id));
  }

  @Patch(':invoiceId/exceptions/:exceptionId')
  @ApiOperation({ summary: 'Resuelve o descarta una excepcion (decision humana, queda en auditoria)' })
  async resolveException(
    @Param('invoiceId') invoiceId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: ResolveExceptionDto,
  ) {
    const invoice = await this.invoices.resolveException(
      invoiceId,
      exceptionId,
      dto.status,
      dto.note,
    );
    return toInvoiceResponse(invoice);
  }

  @Post(':invoiceId/exceptions/:exceptionId/devin-session')
  @ApiOperation({
    summary: 'Lanza una investigacion en Devin para la excepcion y la deja en revision',
    description:
      'Devin recopila evidencia y devuelve salida estructurada; la liberacion del pago sigue siendo humana.',
  })
  async createDevinSession(
    @Param('invoiceId') invoiceId: string,
    @Param('exceptionId') exceptionId: string,
    @Body() dto: CreateDevinSessionDto,
  ) {
    const session = await this.devin.createSession(dto);
    const invoice = await this.invoices.linkDevinSession(
      invoiceId,
      exceptionId,
      session.session_id,
      session.url,
    );
    return { session, invoice: toInvoiceResponse(invoice) };
  }
}
