export class TicketResponseDto {
id!: string;
placa!: string;
dni!: string;
datosPersona?:String;
idEspacio!: string;
zona!: string;
fechaHoraIngreso!: Date;
fechaHoraSalida!: Date;
ValorRecaudo!: number;
activo!: boolean;
tiempoHoras!: number;

}