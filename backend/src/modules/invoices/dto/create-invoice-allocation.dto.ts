import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Linea de reparto analitico de la factura. `value` se interpreta segun `mode`:
 * como importe en la divisa de la factura o como porcentaje del total.
 */
export class CreateInvoiceAllocationDto {
  @ApiProperty({ example: 'CC-IT-INFRA', description: 'Codigo de CECO del maestro' })
  @IsString()
  costCenterCode: string;

  @ApiProperty({ enum: ['amount', 'percent'] })
  @IsIn(['amount', 'percent'])
  mode: 'amount' | 'percent';

  @ApiProperty({ example: 50, description: 'Importe imputado o porcentaje del total' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Categoria de compra imputada; por defecto la de la factura' })
  @IsOptional()
  @IsString()
  categoryCode?: string;
}
