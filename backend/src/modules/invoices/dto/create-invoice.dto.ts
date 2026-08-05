import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateInvoiceLineDto } from './create-invoice-line.dto';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'NIM-2026-0812' })
  @IsString()
  @Length(1, 60)
  invoiceNumber: string;

  @ApiProperty({ example: 'sup-001' })
  @IsString()
  supplierId: string;

  @ApiPropertyOptional({ example: 'PO-2026-0453' })
  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;

  @ApiPropertyOptional({ example: 'CTR-CLOUD-2026' })
  @IsOptional()
  @IsString()
  contractReference?: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  issueDate: string;

  @ApiProperty({ example: '2026-07-03' })
  @IsDateString()
  receivedDate: string;

  @ApiProperty({ example: '2026-08-30' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: 'EUR' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  exchangeRate: number;

  @ApiProperty({ example: 21 })
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate: number;

  @ApiProperty({ example: 60 })
  @IsNumber()
  @Min(0)
  paymentTermsDays: number;

  @ApiProperty({ enum: ['transfer', 'direct_debit', 'card', 'check'] })
  @IsIn(['transfer', 'direct_debit', 'card', 'check'])
  paymentMethod: 'transfer' | 'direct_debit' | 'card' | 'check';

  @ApiProperty({ example: 'ES9121000418450200051332' })
  @IsString()
  @Length(5, 34)
  bankAccountIban: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountHolder?: string;

  @ApiProperty({ example: 'CC-IT-INFRA' })
  @IsString()
  costCenter: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  requesterEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['manual', 'ocr', 'edi', 'email', 'supplier_portal'] })
  @IsIn(['manual', 'ocr', 'edi', 'email', 'supplier_portal'])
  source: 'manual' | 'ocr' | 'edi' | 'email' | 'supplier_portal';

  @ApiProperty({ type: [CreateInvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];

  @ApiPropertyOptional({ description: 'Base imponible declarada en el documento' })
  @IsOptional()
  @IsNumber()
  declaredSubtotal?: number;

  @ApiPropertyOptional({ description: 'Impuesto declarado en el documento' })
  @IsOptional()
  @IsNumber()
  declaredTaxAmount?: number;

  @ApiPropertyOptional({ description: 'Total declarado en el documento' })
  @IsOptional()
  @IsNumber()
  declaredTotalAmount?: number;

  @ApiPropertyOptional({ description: 'Categoria forzada por el operador' })
  @IsOptional()
  @IsString()
  manualCategoryCode?: string;
}
