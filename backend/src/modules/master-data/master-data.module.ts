import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';
import { SpendCategory } from './entities/spend-category.entity';
import { Supplier } from './entities/supplier.entity';
import { SupplierBankAccount } from './entities/supplier-bank-account.entity';
import { BankAccountChange } from './entities/bank-account-change.entity';
import { Contract } from './entities/contract.entity';
import { ContractPrice } from './entities/contract-price.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderLine } from './entities/purchase-order-line.entity';
import { ToleranceProfile } from './entities/tolerance-profile.entity';
import { ToleranceRule } from './entities/tolerance-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpendCategory,
      Supplier,
      SupplierBankAccount,
      BankAccountChange,
      Contract,
      ContractPrice,
      PurchaseOrder,
      PurchaseOrderLine,
      ToleranceProfile,
      ToleranceRule,
    ]),
  ],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService, TypeOrmModule],
})
export class MasterDataModule {}
