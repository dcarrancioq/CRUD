import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DuplicateCandidate } from '../invoices/entities/duplicate-candidate.entity';
import { InvoiceException } from '../invoices/entities/invoice-exception.entity';
import { InvoiceAllocation } from '../invoices/entities/invoice-allocation.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { MasterDataModule } from '../master-data/master-data.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ProcurementAnalyticsService } from './procurement-analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceAllocation, InvoiceException, DuplicateCandidate]),
    MasterDataModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ProcurementAnalyticsService],
})
export class ReportsModule {}
