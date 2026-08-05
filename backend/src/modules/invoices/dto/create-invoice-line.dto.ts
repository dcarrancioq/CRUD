import { IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceLineDto {
  @ApiPropertyOptional({ example: 'CLOUD-VM-M' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiProperty({ example: 'Instancia computo mediana' })
  @IsString()
  @Length(1, 200)
  description: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 'unidad/mes' })
  @IsString()
  uom: string;

  @ApiProperty({ example: 120 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 21 })
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenter?: string;
}
