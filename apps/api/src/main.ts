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
import helmet from '@fastify/helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10485760 }) // 10MB for JSON bodies only
  );

  // Enable gzip/brotli compression for all responses
  await app.register(compress, { global: true });

  // Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP managed by Next.js frontend
    crossOriginEmbedderPolicy: false, // Allow embedding resources (images, fonts)
  });

  // Enable multipart/form-data for file uploads (50MB limit)
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
      files: 1, // Max 1 file per request
    },
  });
  
  const configService = app.get(ConfigService);

  // ── Security: Validate JWT_SECRET at startup ──
  const jwtSecret = configService.get<string>('JWT_SECRET') || '';
  const INSECURE_DEFAULTS = ['change_this_in_production', 'lms-super-secret-key-2026', 'secret', 'jwt_secret'];
  if (!jwtSecret || jwtSecret.length < 16 || INSECURE_DEFAULTS.includes(jwtSecret)) {
    console.error('\n❌ FATAL: JWT_SECRET is missing, too short (<16 chars), or using an insecure default.');
    console.error('   Generate a secure one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    console.error('   Then set it in your .env file.\n');
    process.exit(1);
  }
  
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: configService.get('CORS_ORIGIN') || 'http://localhost:3100',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger API docs — only in development (never expose API schema in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Enterprise LMS API')
      .setDescription('LMS Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Enable WebSocket support with native ws adapter (compatible with Fastify)
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = process.env.APP_PORT || 3200;
  await app.listen(port, '0.0.0.0');
  console.log(`LMS API running on http://localhost:${port}/api`);
}
bootstrap();
