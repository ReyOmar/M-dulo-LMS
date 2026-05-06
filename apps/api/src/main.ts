import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10485760 }) // 10MB for JSON bodies only
  );

  // Enable gzip/brotli compression for all responses
  await app.register(compress, { global: true });

  // Enable multipart/form-data for file uploads (50MB limit)
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
      files: 1, // Max 1 file per request
    },
  });
  
  const configService = app.get(ConfigService);
  
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Enterprise LMS API')
    .setDescription('LMS Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Enable WebSocket support with native ws adapter (compatible with Fastify)
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = process.env.APP_PORT || 3200;
  await app.listen(port, '0.0.0.0');
  console.log(`LMS API running on http://localhost:${port}/api`);
}
bootstrap();
