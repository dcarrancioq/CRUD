import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateDevinSessionDto } from '../devin/dto/create-devin-session.dto';
import { DevinService } from '../devin/devin.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ResolveExceptionDto } from './dto/resolve-exception.dto';
import { toInvoiceResponse } from './invoice.mapper';
import { InvoiceExtractionService } from './services/invoice-extraction.service';
import {
  INVOICE_SORT_FIELDS,
  InvoiceSortField,
  InvoicesService,
} from './services/invoices.service';

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024;

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly devin: DevinService,
    private readonly extraction: InvoiceExtractionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado de facturas con clasificacion, riesgo y excepciones' })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'limit', required: false, description: 'Tamaño de ventana (200 por defecto)' })
  @ApiQuery({ name: 'search', required: false, description: 'Numero, proveedor, NIF o categoria' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'riskBand', required: false })
  @ApiQuery({ name: 'onlyExceptions', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: INVOICE_SORT_FIELDS })
  @ApiQuery({ name: 'direction', required: false, enum: ['asc', 'desc'] })
  async findAll(
    @Query('supplierId') supplierId?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('riskBand') riskBand?: string,
    @Query('onlyExceptions') onlyExceptions?: string,
    @Query('sort') sort?: string,
    @Query('direction') direction?: string,
  ) {
    const invoices = await this.invoices.findAll({
      supplierId: supplierId || undefined,
      limit: limit ? Number(limit) : undefined,
      search: search || undefined,
      status: status || undefined,
      riskBand: riskBand || undefined,
      onlyExceptions: onlyExceptions === 'true',
      sort: this.parseSort(sort),
      direction: direction === 'asc' ? 'asc' : 'desc',
    });
    return invoices.map(toInvoiceResponse);
  }

  /** Solo se admiten columnas conocidas: el nombre llega a la clausula ORDER BY. */
  private parseSort(sort?: string): InvoiceSortField | undefined {
    return INVOICE_SORT_FIELDS.find((field) => field === sort);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Totales agregados de la bandeja (gasto, bloqueos, excepciones)' })
  summary() {
    return this.invoices.summary();
  }

  @Get('options')
  @ApiOperation({ summary: 'Opciones ligeras de factura para desplegables con busqueda' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false })
  options(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.invoices.findOptions(search, limit ? Number(limit) : undefined);
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

  @Post('import')
  @ApiOperation({
    summary: 'Extrae los campos de factura de un PDF, Word o Excel',
    description:
      'Devuelve una propuesta para prerellenar el alta; la factura no se registra hasta que una persona la valida.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_SIZE_BYTES } }))
  async import(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_IMPORT_SIZE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('El fichero esta vacio.');
    }
    return this.extraction.extract(file.originalname, file.buffer);
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
