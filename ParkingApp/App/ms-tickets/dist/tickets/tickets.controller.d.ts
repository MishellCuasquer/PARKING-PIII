import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    create(createTicketDto: CreateTicketDto, authorization?: string): Promise<Ticket>;
    findAll(): Promise<Ticket[]>;
    findActivos(): Promise<Ticket[]>;
    findOne(id: string): Promise<Ticket>;
    cerrarTicket(id: string, updateTicketDto: UpdateTicketDto, authorization?: string): Promise<Ticket>;
    update(id: string, updateTicketDto: UpdateTicketDto, authorization?: string): Promise<Ticket>;
    remove(id: string): Promise<void>;
}
