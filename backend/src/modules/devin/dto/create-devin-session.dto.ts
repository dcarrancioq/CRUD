import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDevinSessionDto {
  @ApiProperty({ description: 'Prompt con el contexto de la excepcion y los limites de actuacion' })
  @IsString()
  prompt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: [String], description: 'Etiquetas para imputar ACUs por excepcion/factura' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Evita duplicar sesiones si se reintenta la misma excepcion' })
  @IsOptional()
  @IsBoolean()
  idempotent?: boolean;

  @ApiPropertyOptional({ description: 'Tope de ACUs para acotar el coste de la investigacion' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_acu_limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  playbook_id?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledge_ids?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secret_ids?: string[];

  @ApiPropertyOptional({ description: 'Esquema de salida estructurada para poder consumir el resultado' })
  @IsOptional()
  @IsObject()
  structured_output_schema?: Record<string, unknown>;
}
