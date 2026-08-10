import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AnalyticsPeriod } from './analytics.types';
import { ProcurementAnalyticsService } from './procurement-analytics.service';
import { ReportsService } from './reports.service';

const PERIODS: AnalyticsPeriod[] = ['month', 'quarter', 'year'];

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly analytics: ProcurementAnalyticsService,
  ) {}

  @Get('years')
  @ApiOperation({ summary: 'Ejercicios disponibles para informes' })
  years() {
    return this.reports.availableYears();
  }

  @Get('suppliers/directory')
  @ApiOperation({
    summary: 'Listado de proveedores con sociedades, areas y contratos asociados',
  })
  @ApiQuery({ name: 'search', required: false })
  supplierDirectory(@Query('search') search?: string) {
    return this.analytics.supplierDirectory(search);
  }

  @Get('analytics')
  @ApiOperation({
    summary:
      'Cuadro de mando de compras: presupuesto, consumo, compromisos, desviaciones e indicadores de proveedor',
    description:
      'Filtrable por sociedad, area, categoria de compra, proveedor y periodo (mensual, trimestral o anual).',
  })
  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'orgUnitId', required: false })
  @ApiQuery({ name: 'categoryCode', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  analyticsReport(
    @Query('year') year: string,
    @Query('period') period?: string,
    @Query('companyId') companyId?: string,
    @Query('orgUnitId') orgUnitId?: string,
    @Query('categoryCode') categoryCode?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.analytics.report({
      fiscalYear: this.parseYear(year),
      period: this.parsePeriod(period),
      companyId: companyId || undefined,
      orgUnitId: orgUnitId || undefined,
      categoryCode: categoryCode || undefined,
      supplierId: supplierId || undefined,
    });
  }

  @Get('suppliers/:supplierId')
  @ApiOperation({
    summary: 'Informe de proveedor: consumido vs presupuesto, seguimiento, desviaciones y alertas',
  })
  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'orgUnitId', required: false })
  @ApiQuery({ name: 'categoryCode', required: false })
  supplierReport(
    @Param('supplierId') supplierId: string,
    @Query('year') year: string,
    @Query('companyId') companyId?: string,
    @Query('orgUnitId') orgUnitId?: string,
    @Query('categoryCode') categoryCode?: string,
  ) {
    return this.reports.supplierReport(supplierId, this.parseYear(year), {
      companyId: companyId || undefined,
      orgUnitId: orgUnitId || undefined,
      categoryCode: categoryCode || undefined,
    });
  }

  private parseYear(year: string): number {
    const fiscalYear = Number(year);
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      throw new BadRequestException('El parametro year debe ser un ejercicio valido');
    }
    return fiscalYear;
  }

  private parsePeriod(period?: string): AnalyticsPeriod {
    if (!period) {
      return 'month';
    }
    if (!PERIODS.includes(period as AnalyticsPeriod)) {
      throw new BadRequestException('El parametro period debe ser month, quarter o year');
    }
    return period as AnalyticsPeriod;
  }
}
