import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';

@Controller('audit')
@UseGuards(ThrottlerGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  create(@Body() createAuditDto: CreateAuditEventDto) {
    return this.auditService.create(createAuditDto);
  }

  @Get()
  findAll() {
    return this.auditService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditService.findone(id);
  }

 
  }
