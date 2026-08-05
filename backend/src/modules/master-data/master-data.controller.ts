import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Get('suppliers/:id/bank-account-changes')
  @ApiOperation({ summary: 'Historico de cambios de cuenta bancaria de un proveedor' })
  bankAccountChanges(@Param('id') id: string) {
    return this.masterData.findBankAccountChanges(id);
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
