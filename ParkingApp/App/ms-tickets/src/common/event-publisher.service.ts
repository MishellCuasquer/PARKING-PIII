import { Injectable ,OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as amqp from 'amqplib';


export interface AuditEvent {
  servicio: string;
  accion: string;
  entidad: string;
  datos?: any;
  usuario?: string;
  ip?: string;
  mac?: string;

}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy{
    private readonly logger = new Logger(EventPublisher.name);

    private connection:  any;
    private channel: any;
    private exchangeName: string;
    private routingKey: string;

    constructor(private configService: ConfigService ) {
        this.exchangeName = this.configService.get<string>('RABBITMQ_EXCHANGE') ?? '';
        this.routingKey = this.configService.get<string>('RABBITMQ_ROUTING_KEY') ?? '';

    }

    async onModuleInit() {
        await this.connect();
    }

    private async connect() {
        try{
            const host = this.configService.get('RABBITMQ_HOST');
            const port = this.configService.get('RABBITMQ_PORT');
            const user = this.configService.get('RABBITMQ_USER');
            const pass = this.configService.get('RABBITMQ_PASSWORD');
            const url = `amqp://${user}:${pass}@${host}:${port}`;



            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
            this.logger.log(`Connected to RabbitMQ at ${url}`);


        } catch (error) {
            this.logger.error(`Failed to connect to RabbitMQ: ${error}`);
            setTimeout(() => this.connect(), 5000); // Retry after 5 seconds
        }

    }

    async publishEvent(event: AuditEvent): Promise<void> {
        if(!this.channel){
            this.logger.warn('Channel not established, attempting to connect...');
            return;

        }

        try{
        const message = Buffer.from(JSON.stringify(event));
        this.channel.publish(this.exchangeName, this.routingKey, message,{persistent: true});
        this.logger.debug(`Evento publicado: ${event.servicio} - ${event.accion} - ${event.entidad}`);

        }catch (error) {
            this.logger.error(`Failed to publish event: ${error}`);
        }

    }


    async onModuleDestroy() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
    }
}
