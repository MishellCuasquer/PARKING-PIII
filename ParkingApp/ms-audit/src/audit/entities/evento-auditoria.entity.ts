import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'evento_auditoria' })
export class EventoAuditoria {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50 })
    servicio!: string;  //ej. "auth", "user", "products", etc.

    @Column({ type: 'varchar', length: 50 })
    accion!: string;  //ej. "create", "update", "delete", etc.

    @Column({ type: 'varchar', length: 100 })
    entidad!: string;  //ej. "user", "product", etc.


    @Column({ type: 'jsonb', nullable: true })
    datos!: Record<string, any>;  //ej. { "id": 1, "name": "John Doe" }


    //CONSULTAR SI TENEMOS JWT

    @Column({ type: 'varchar', length: 100 })
    usuario!: string;  //ej. "john.doe", "admin", etc.

    @Column({ type: 'varchar', length: 50 })
    ip!: string;  //ej. "192.168.1.1"

    @Column({ type: 'varchar', length: 50 })
    mac!: string;  //ej. "00:1A:2B:3C:4D:5E"

    @Column({ type: 'timestamp' })
    timestamp!: Date;  //ej. "2023-01-01T12:00:00Z"


}
