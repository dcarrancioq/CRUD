import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierBankAccountDto {
  @ApiProperty({ example: 'ES9121000418450200051332' })
  @IsString()
  @Length(15, 40)
  iban: string;

  @ApiPropertyOptional({ example: 'CAIXESBBXXX' })
  @IsOptional()
  @IsString()
  bic?: string;

  @ApiProperty({ example: 'Nexora Software Labs, S.L.' })
  @IsString()
  @Length(2, 160)
  holderName: string;

  @ApiPropertyOptional({ enum: ['callback', 'portal', 'certificate', 'none'] })
  @IsOptional()
  @IsIn(['callback', 'portal', 'certificate', 'none'])
  verificationChannel?: 'callback' | 'portal' | 'certificate' | 'none';
}

export class CreateSupplierBudgetDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscalYear: number;

  @ApiProperty({ example: 120000 })
  @IsNumber()
  @Min(0)
  budgetAmount: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 85 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertThresholdPercent?: number;

  @ApiPropertyOptional({ example: 'compras.it@empresa.com' })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;
}

/**
 * Alta de proveedor en el maestro. Se usa cuando la importacion de una factura
 * detecta un emisor que no esta dado de alta: la cuenta de cobro entra siempre
 * como pendiente de verificacion para que el control antifraude siga aplicando.
 */
export class CreateSupplierDto {
  @ApiProperty({ example: 'B00000000' })
  @IsString()
  @Length(6, 20)
  taxId: string;

  @ApiProperty({ example: 'Nexora Software Labs, S.L.' })
  @IsString()
  @Length(2, 160)
  legalName: string;

  @ApiPropertyOptional({ example: 'Nexora' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  tradeName?: string;

  @ApiPropertyOptional({ example: 'ES' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ enum: ['active', 'blocked', 'pending_validation', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'blocked', 'pending_validation', 'inactive'])
  status?: 'active' | 'blocked' | 'pending_validation' | 'inactive';

  @ApiPropertyOptional({ example: 'SW-LIC' })
  @IsOptional()
  @IsString()
  defaultCategoryCode?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;

  @ApiPropertyOptional({ example: 'facturacion@nexora.example' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 20, description: 'Riesgo de maestro (0-100) que aporta compliance' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiPropertyOptional({ type: CreateSupplierBankAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSupplierBankAccountDto)
  bankAccount?: CreateSupplierBankAccountDto;

  @ApiPropertyOptional({ type: CreateSupplierBudgetDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSupplierBudgetDto)
  budget?: CreateSupplierBudgetDto;
}
