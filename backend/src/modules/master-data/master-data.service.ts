import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpendCategory } from './entities/spend-category.entity';
import { Supplier } from './entities/supplier.entity';
import { SupplierBankAccount } from './entities/supplier-bank-account.entity';
import { BankAccountChange } from './entities/bank-account-change.entity';
import { Contract } from './entities/contract.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { ToleranceProfile } from './entities/tolerance-profile.entity';

export const DEFAULT_TOLERANCE_PROFILE_ID = 'tol-default';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(SpendCategory) private categories: Repository<SpendCategory>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(SupplierBankAccount) private bankAccounts: Repository<SupplierBankAccount>,
    @InjectRepository(BankAccountChange) private bankAccountChanges: Repository<BankAccountChange>,
    @InjectRepository(Contract) private contracts: Repository<Contract>,
    @InjectRepository(PurchaseOrder) private purchaseOrders: Repository<PurchaseOrder>,
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
