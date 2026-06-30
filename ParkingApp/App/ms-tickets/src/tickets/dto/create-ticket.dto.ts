import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateTicketDto {
    @ApiProperty({ example: 'ABC-1234', description: 'Placa del vehículo' })
    @IsString()
    @IsNotEmpty()
    placa!: string;

    @ApiProperty({ example: '0604052068', description: 'DNI del propietario' })
    @IsString()
    @IsNotEmpty()
    dni!: string;

    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001', description: 'UUID del espacio disponible' })
    @IsUUID()
    @IsNotEmpty()
    idEspacio!: string;
}
