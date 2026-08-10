import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompareInvoicesDto {
  @ApiProperty({ description: 'Id de la factura A' })
  @IsString()
  left: string;

  @ApiProperty({ description: 'Id de la factura B' })
  @IsString()
  right: string;
}
