import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DuplicateCandidate } from '../invoices/entities/duplicate-candidate.entity';
import { InvoiceException } from '../invoices/entities/invoice-exception.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { MasterDataModule } from '../master-data/master-data.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceException, DuplicateCandidate]),
    MasterDataModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
