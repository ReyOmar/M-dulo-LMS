import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { PrismaModule } from './prisma/prisma.module';

import { AuthModule } from './auth/auth.module';
import { CursosModule } from './cursos/cursos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
    }),
    ConfiguracionModule,
    PrismaModule,
    AuthModule,
    CursosModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
