import { ConfigService } from '@nestjs/config';

export const getRabbitMQConfig = (config: ConfigService) => ({
    host: config.get<string>('RABBITMQ_HOST'),
    port: config.get<number>('RABBITMQ_PORT'),
    username: config.get<string>('RABBITMQ_USER'),
    password: config.get<string>('RABBITMQ_PASSWORD'),
    queue: config.get<string>('RABBITMQ_QUEUE'),
    exchange: config.get<string>('RABBITMQ_EXCHANGE'),
    routingKey: config.get<string>('RABBITMQ_ROUTING_KEY'),
   
  });