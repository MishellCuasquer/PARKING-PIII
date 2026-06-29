export declare class Ticket {
    id: string;
    placa: string;
    dni: string;
    idEspacio: string;
    nombreZona: string;
    fechhaHoraIngreso: Date;
    fechhaHoraSalida?: Date;
    activo: boolean;
    valorRecaudo: number;
    createdAt: Date;
    updatedAt: Date;
}
