import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExceptionStatus } from '../entities/invoice-exception.entity';

export class ResolveExceptionDto {
  @ApiProperty({ enum: ['open', 'in_review', 'resolved', 'false_positive', 'escalated'] })
  @IsIn(['open', 'in_review', 'resolved', 'false_positive', 'escalated'])
  status: ExceptionStatus;

  @ApiPropertyOptional({ description: 'Justificacion del revisor, queda en la traza de auditoria' })
  @IsOptional()
  @IsString()
  note?: string;
}
