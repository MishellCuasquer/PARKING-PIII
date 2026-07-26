export interface Espacio{
    estado: string;
    id: string;
    codigo: string;
    zona: string;
    nombreZona?: string;
    disponible: boolean;
    // Categoria de la zona (VIP, GENERAL...), no el tipo de vehiculo
    tipo?: string;
    // Tipo de vehiculo al que sirve el espacio: AUTO, MOTO, BUSETA, BUS, CAMION
    tipoEspacio?: string;
}