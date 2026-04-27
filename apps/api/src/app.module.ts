import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { ConfiguracionModule } from './configuracion/configuracion.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CursosModule } from './cursos/cursos.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
    }),

    // JWT — available globally for signing/verifying tokens
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),

    // Rate Limiting — 60 requests per minute per IP (global)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 60 }],
    }),

    ConfiguracionModule,
    PrismaModule,
    AuthModule,
    CursosModule,
  ],
  controllers: [],
  providers: [
    // Global JWT authentication guard — all routes protected by default
    // Use @Public() decorator to bypass on specific routes
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global rate limiting guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
