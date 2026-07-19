import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('Tickets')
export class Ticket {

    @ApiPropertyOptional({ description: 'Empresa/parqueadero dueño del ticket' })
    @Index()
    @Column({ type: 'uuid', nullable: true })
    tenantId?: string | null;
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ApiProperty({ example: 'ABC-1234' })
    @Column()
    placa!: string;

    @ApiProperty({ example: '0604052068' })
    @Column()
    dni!: string;

    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
    @Column({ type: 'uuid' })
    idEspacio!: string;

    @ApiProperty({ example: 'Zona VIP' })
    @Column()
    nombreZona!: string;

    @ApiProperty()
    @Column({ type: 'timestamp' })
    fechhaHoraIngreso!: Date;

    @ApiPropertyOptional()
    @Column({ type: 'timestamp', nullable: true })
    fechhaHoraSalida?: Date;

    @ApiProperty({ example: true })
    @Column({ default: true })
    activo!: boolean;

    @ApiProperty({ example: 0 })
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    valorRecaudo!: number;

    @ApiPropertyOptional({ description: 'Usuario (userId del JWT) que emitió el ticket' })
    @Column({ nullable: true })
    emisorUserId?: string;

    @ApiPropertyOptional({ description: 'Usuario (userId del JWT) que cerró/cobró el ticket' })
    @Column({ nullable: true })
    cobradorUserId?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
