import { IsIP, IsString, IsNotEmpty, MaxLength, MinLength, Matches, IsObject, IsOptional } from 'class-validator';

export class CreateAuditEventDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(7)
    @MaxLength(50)
    @Matches(/^ms-[a-zA-Z0-9_-]+$/, { 
        message: 'El servicio debe comenzar con "ms-" segido de letras.'})
        
    servicio!: string;
    //un nuevo comnetario de prueba
    //nuevo
    //action
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(10) 
    @Matches(/^(CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT)$/, { 
        message: 'La acción debe ser una de las siguientes: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, SELECT.'})
    accion!: string;   // CREATE -UPDATE - DELETE - LOGIN - LOGOUT - SELECT 

    
     @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(15)
        @Matches(/^[a-zA-Z0-9_-]+$/, {
        message: 'el campo solo debe contener letras mayusculas y guiones medios.'})
    entidad!: string;


    @IsObject()
    @IsOptional()
    datos!: Record<string, any>;  


    @IsString()
    @IsOptional()
    @MaxLength(50)
    @Matches(/^[a-zA-Z0-9_-]+$/, {
        message: 'el campo solo debe contener letras mayusculas y guiones medios.'})
    usuario!: string;  

    @IsIP()
    @IsNotEmpty()
        ip!: string;  


    @IsString()
    @IsOptional()
    mac!: string;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    tenantId?: string;


}
