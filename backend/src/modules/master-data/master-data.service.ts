import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateId, normalizeIban } from '../invoices/invoice.utils';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SpendCategory } from './entities/spend-category.entity';
import { Supplier } from './entities/supplier.entity';
import { SupplierBankAccount } from './entities/supplier-bank-account.entity';
import { BankAccountChange } from './entities/bank-account-change.entity';
import { Company } from './entities/company.entity';
import { Contract } from './entities/contract.entity';
import { CostCenter } from './entities/cost-center.entity';
import { DimensionBudget } from './entities/dimension-budget.entity';
import { OrgUnit } from './entities/org-unit.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { SupplierBudget } from './entities/supplier-budget.entity';
import { ToleranceProfile } from './entities/tolerance-profile.entity';

export const DEFAULT_TOLERANCE_PROFILE_ID = 'tol-default';

export interface AllocationTarget {
  costCenterCode: string;
  costCenterName: string;
  companyId: string;
  companyName: string;
  orgUnitId: string;
  orgUnitName: string;
}

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(SpendCategory) private categories: Repository<SpendCategory>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(SupplierBankAccount) private bankAccounts: Repository<SupplierBankAccount>,
    @InjectRepository(BankAccountChange) private bankAccountChanges: Repository<BankAccountChange>,
    @InjectRepository(Company) private companies: Repository<Company>,
    @InjectRepository(OrgUnit) private orgUnits: Repository<OrgUnit>,
    @InjectRepository(CostCenter) private costCenters: Repository<CostCenter>,
    @InjectRepository(DimensionBudget) private dimensionBudgets: Repository<DimensionBudget>,
    @InjectRepository(Contract) private contracts: Repository<Contract>,
    @InjectRepository(PurchaseOrder) private purchaseOrders: Repository<PurchaseOrder>,
    @InjectRepository(SupplierBudget) private budgets: Repository<SupplierBudget>,
    @InjectRepository(ToleranceProfile) private toleranceProfiles: Repository<ToleranceProfile>,
  ) {}

  findCategories(): Promise<SpendCategory[]> {
    return this.categories.find({ order: { code: 'ASC' } });
  }

  findCategory(code: string): Promise<SpendCategory | null> {
    return this.categories.findOne({ where: { code } });
  }

  findSuppliers(): Promise<Supplier[]> {
    return this.suppliers.find({ order: { legalName: 'ASC' } });
  }

  findSupplier(id: string): Promise<Supplier | null> {
    return this.suppliers.findOne({ where: { id } });
  }

  async findSupplierOrFail(id: string): Promise<Supplier> {
    const supplier = await this.findSupplier(id);
    if (!supplier) {
      throw new NotFoundException(`Proveedor ${id} no encontrado en el maestro`);
    }
    return supplier;
  }

  /**
   * Alta de proveedor desde compras (tipicamente al importar una factura de un
   * emisor que no esta en el maestro). La cuenta de cobro nace pendiente de
   * verificacion: el control antifraude de la factura seguira exigiendo la
   * validacion antes de liberar el pago.
   */
  async createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
    const taxId = dto.taxId.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existing = await this.suppliers.findOne({ where: { taxId } });
    if (existing) {
      throw new ConflictException(
        `El NIF/CIF ${taxId} ya esta dado de alta como ${existing.legalName}.`,
      );
    }

    const supplier = this.suppliers.create({
      id: generateId('sup'),
      taxId,
      legalName: dto.legalName.trim(),
      tradeName: dto.tradeName?.trim() ?? dto.legalName.trim(),
      country: (dto.country ?? 'ES').toUpperCase(),
      status: dto.status ?? 'pending_validation',
      defaultCategoryCode: dto.defaultCategoryCode ?? '',
      paymentTermsDays: dto.paymentTermsDays ?? 30,
      onboardedAt: new Date(),
      riskScore: dto.riskScore ?? 0,
      contactEmail: dto.contactEmail ?? '',
    });
    await this.suppliers.save(supplier);

    if (dto.bankAccount) {
      await this.bankAccounts.save(
        this.bankAccounts.create({
          id: generateId('acc'),
          supplierId: supplier.id,
          iban: normalizeIban(dto.bankAccount.iban),
          bic: dto.bankAccount.bic ?? '',
          holderName: dto.bankAccount.holderName.trim(),
          status: 'pending_verification',
          isPrimary: true,
          registeredAt: new Date(),
          verificationChannel: dto.bankAccount.verificationChannel ?? 'none',
        }),
      );
    }

    if (dto.budget) {
      await this.budgets.save(
        this.budgets.create({
          id: generateId('bud'),
          supplierId: supplier.id,
          fiscalYear: dto.budget.fiscalYear,
          budgetAmount: dto.budget.budgetAmount,
          currency: dto.budget.currency ?? 'EUR',
          categoryCode: dto.defaultCategoryCode ?? '',
          alertThresholdPercent: dto.budget.alertThresholdPercent ?? 85,
          ownerEmail: dto.budget.ownerEmail ?? '',
        }),
      );
    }

    return this.findSupplierOrFail(supplier.id);
  }

  findCompanies(): Promise<Company[]> {
    return this.companies.find({ order: { code: 'ASC' } });
  }

  findOrgUnits(companyId?: string): Promise<OrgUnit[]> {
    return this.orgUnits.find({
      where: companyId ? { companyId } : {},
      order: { companyId: 'ASC', code: 'ASC' },
    });
  }

  findCostCenters(filter: { companyId?: string; orgUnitId?: string } = {}): Promise<CostCenter[]> {
    const where: { companyId?: string; orgUnitId?: string } = {};
    if (filter.companyId) {
      where.companyId = filter.companyId;
    }
    if (filter.orgUnitId) {
      where.orgUnitId = filter.orgUnitId;
    }
    return this.costCenters.find({ where, order: { code: 'ASC' } });
  }

  findCostCenterByCode(code: string): Promise<CostCenter | null> {
    return this.costCenters.findOne({ where: { code } });
  }

  /**
   * Dimensiones que quedan determinadas al imputar a un CECO, indexadas por
   * codigo de CECO: sociedad y area a las que pertenece.
   */
  async findAllocationTargets(): Promise<Map<string, AllocationTarget>> {
    const [costCenters, companies, orgUnits] = await Promise.all([
      this.costCenters.find(),
      this.companies.find(),
      this.orgUnits.find(),
    ]);
    const companyNames = new Map(companies.map((company) => [company.id, company.legalName]));
    const orgUnitNames = new Map(orgUnits.map((unit) => [unit.id, unit.name]));

    return new Map(
      costCenters.map((costCenter) => [
        costCenter.code,
        {
          costCenterCode: costCenter.code,
          costCenterName: costCenter.name,
          companyId: costCenter.companyId,
          companyName: companyNames.get(costCenter.companyId) ?? costCenter.companyId,
          orgUnitId: costCenter.orgUnitId,
          orgUnitName: orgUnitNames.get(costCenter.orgUnitId) ?? costCenter.orgUnitId,
        },
      ]),
    );
  }

  /** Presupuesto analitico al grano sociedad + area + categoria de un ejercicio. */
  findDimensionBudgets(fiscalYear?: number): Promise<DimensionBudget[]> {
    return this.dimensionBudgets.find({
      where: fiscalYear ? { fiscalYear } : {},
      order: { fiscalYear: 'DESC', companyId: 'ASC' },
    });
  }

  findBudgets(supplierId?: string): Promise<SupplierBudget[]> {
    return this.budgets.find({
      where: supplierId ? { supplierId } : {},
      order: { fiscalYear: 'DESC' },
    });
  }

  findBudget(supplierId: string, fiscalYear: number): Promise<SupplierBudget | null> {
    return this.budgets.findOne({ where: { supplierId, fiscalYear } });
  }

  async findBudgetYears(): Promise<number[]> {
    const rows = await this.budgets
      .createQueryBuilder('budget')
      .select('DISTINCT budget.fiscal_year', 'year')
      .orderBy('year', 'DESC')
      .getRawMany<{ year: number }>();
    return rows.map((row) => Number(row.year));
  }

  findContracts(): Promise<Contract[]> {
    return this.contracts.find({ order: { reference: 'ASC' } });
  }

  findContractsBySupplier(supplierId: string): Promise<Contract[]> {
    return this.contracts.find({ where: { supplierId } });
  }

  findPurchaseOrders(): Promise<PurchaseOrder[]> {
    return this.purchaseOrders.find({ order: { number: 'ASC' } });
  }

  findPurchaseOrderByNumber(number: string): Promise<PurchaseOrder | null> {
    return this.purchaseOrders.findOne({ where: { number } });
  }

  findBankAccountChanges(supplierId: string): Promise<BankAccountChange[]> {
    return this.bankAccountChanges.find({ where: { supplierId }, order: { changedAt: 'DESC' } });
  }

  findBankAccounts(supplierId: string): Promise<SupplierBankAccount[]> {
    return this.bankAccounts.find({ where: { supplierId } });
  }

  async findToleranceProfile(): Promise<ToleranceProfile> {
    const profile = await this.toleranceProfiles.findOne({
      where: { id: DEFAULT_TOLERANCE_PROFILE_ID },
    });
    if (!profile) {
      throw new NotFoundException(
        'No hay perfil de tolerancias configurado. Ejecuta "npm run seed" en el backend.',
      );
    }
    profile.rules = (profile.rules ?? []).sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));
    return profile;
  }
}
