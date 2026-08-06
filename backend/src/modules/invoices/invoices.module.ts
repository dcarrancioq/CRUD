import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevinModule } from '../devin/devin.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AuditEvent } from './entities/audit-event.entity';
import { DuplicateCandidate } from './entities/duplicate-candidate.entity';
import { InvoiceException } from './entities/invoice-exception.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoiceAnomalyService } from './services/invoice-anomaly.service';
import { InvoiceComparisonService } from './services/invoice-comparison.service';
import { InvoiceDocumentService } from './services/invoice-document.service';
import { InvoiceExtractionService } from './services/invoice-extraction.service';
import { InvoicesService } from './services/invoices.service';
import { SpendClassificationService } from './services/spend-classification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine, InvoiceException, DuplicateCandidate, AuditEvent]),
    MasterDataModule,
    DevinModule,
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceAnomalyService,
    InvoiceComparisonService,
    InvoiceDocumentService,
    InvoiceExtractionService,
    SpendClassificationService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
