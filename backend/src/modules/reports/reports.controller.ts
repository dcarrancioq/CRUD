import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('years')
  @ApiOperation({ summary: 'Ejercicios disponibles para informes' })
  years() {
    return this.reports.availableYears();
  }

  @Get('suppliers/:supplierId')
  @ApiOperation({
    summary: 'Informe de proveedor: consumido vs presupuesto, seguimiento, desviaciones y alertas',
  })
  @ApiQuery({ name: 'year', required: true })
  supplierReport(@Param('supplierId') supplierId: string, @Query('year') year: string) {
    const fiscalYear = Number(year);
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      throw new BadRequestException('El parametro year debe ser un ejercicio valido');
    }
    return this.reports.supplierReport(supplierId, fiscalYear);
  }
}
