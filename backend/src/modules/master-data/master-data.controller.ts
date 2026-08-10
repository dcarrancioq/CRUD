import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { MasterDataService } from './master-data.service';

@ApiTags('master-data')
@Controller('master-data')
export class MasterDataController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Catalogo de categorias de gasto con sus palabras clave y cuenta contable' })
  categories() {
    return this.masterData.findCategories();
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'Proveedores con sus cuentas bancarias y estado de verificacion' })
  suppliers() {
    return this.masterData.findSuppliers();
  }

  @Post('suppliers')
  @ApiOperation({
    summary: 'Da de alta un proveedor en el maestro',
    description:
      'Se usa cuando la importacion detecta un emisor desconocido. La cuenta de cobro queda pendiente de verificacion.',
  })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.masterData.createSupplier(dto);
  }

  @Get('suppliers/:id/bank-account-changes')
  @ApiOperation({ summary: 'Historico de cambios de cuenta bancaria de un proveedor' })
  bankAccountChanges(@Param('id') id: string) {
    return this.masterData.findBankAccountChanges(id);
  }

  @Get('companies')
  @ApiOperation({ summary: 'Sociedades del grupo a las que se puede imputar gasto' })
  companies() {
    return this.masterData.findCompanies();
  }

  @Get('org-units')
  @ApiOperation({ summary: 'Areas / departamentos, opcionalmente de una sociedad' })
  @ApiQuery({ name: 'companyId', required: false })
  orgUnits(@Query('companyId') companyId?: string) {
    return this.masterData.findOrgUnits(companyId || undefined);
  }

  @Get('cost-centers')
  @ApiOperation({ summary: 'Centros de coste (CECOs) con su sociedad y area' })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'orgUnitId', required: false })
  costCenters(@Query('companyId') companyId?: string, @Query('orgUnitId') orgUnitId?: string) {
    return this.masterData.findCostCenters({
      companyId: companyId || undefined,
      orgUnitId: orgUnitId || undefined,
    });
  }

  @Get('dimension-budgets')
  @ApiOperation({ summary: 'Presupuestos de compras por sociedad, area y categoria' })
  @ApiQuery({ name: 'year', required: false })
  dimensionBudgets(@Query('year') year?: string) {
    const fiscalYear = year ? Number(year) : undefined;
    return this.masterData.findDimensionBudgets(
      Number.isInteger(fiscalYear) ? fiscalYear : undefined,
    );
  }

  @Get('budgets')
  @ApiOperation({ summary: 'Presupuestos anuales por proveedor' })
  budgets() {
    return this.masterData.findBudgets();
  }

  @Get('budget-years')
  @ApiOperation({ summary: 'Ejercicios con presupuesto cargado' })
  budgetYears() {
    return this.masterData.findBudgetYears();
  }

  @Get('suppliers/:id/budgets')
  @ApiOperation({ summary: 'Presupuestos de un proveedor por ejercicio' })
  supplierBudgets(@Param('id') id: string) {
    return this.masterData.findBudgets(id);
  }

  @Get('contracts')
  @ApiOperation({ summary: 'Contratos y tarifas de referencia' })
  contracts() {
    return this.masterData.findContracts();
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Pedidos de compra con cantidades recibidas y facturadas' })
  purchaseOrders() {
    return this.masterData.findPurchaseOrders();
  }

  @Get('tolerance-profile')
  @ApiOperation({ summary: 'Perfil de tolerancias activo (umbrales que definen que es excepcion)' })
  toleranceProfile() {
    return this.masterData.findToleranceProfile();
  }
}
