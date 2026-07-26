import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auditoría API')
    .setDescription(
      'Microservicio de auditoría: consulta del historial de eventos del ' +
        'parqueadero. No publica eventos, solo consume la cola `queue_audit` ' +
        'de RabbitMQ. El acceso lo protege Kong con el plugin jwt.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // El prefijo global es `api`, así que la documentación se sirve en /docs
  // para no chocar con /api/audit.
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3004);
  console.log(`Audit Ms corriendo en el puerto ${process.env.PORT || 3004}`);
  console.log(`Swagger docs: http://localhost:${process.env.PORT || 3004}/docs`);
}
bootstrap();
