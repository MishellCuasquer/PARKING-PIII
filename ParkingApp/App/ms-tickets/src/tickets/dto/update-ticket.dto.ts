import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateTicketDto {
  @ApiPropertyOptional({
    example: '2026-06-19T16:30:00.000Z',
    description: 'Fecha y hora de salida. Si no se envía, se usa la hora actual.',
  })
  @IsOptional()
  @IsDateString()
  fechhaHoraSalida?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si el ticket sigue activo. Enviar false para cerrar el ticket.',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
