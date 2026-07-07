import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { EventoAuditoria } from './entities/evento-auditoria.entity';

@Injectable()
export class AuditService {
 
  constructor(
    @InjectRepository(EventoAuditoria)
    private readonly auditRepo: Repository<EventoAuditoria>,
  ) {}
  


  async create(dto: CreateAuditEventDto): Promise<EventoAuditoria> {
    const newEvent = this.auditRepo.create({
      ...dto,
    timestamp: new Date(Date.now() - (5 * 60 * 60 * 1000)),
  });
    
    return this.auditRepo.save(newEvent);
  }

  async findAll(): Promise<EventoAuditoria[]> {
    return this.auditRepo.find({
      order: {
        timestamp: 'DESC',
      },
    });
  } 

  async findone(id: string): Promise<EventoAuditoria | null> {
    return this.auditRepo.findOne({
      where: { id },
    });
  }
  
  }

