import { Module } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { CursosController } from './cursos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { CertificadosModule } from '../certificados/certificados.module';

@Module({
  imports: [PrismaModule, NotificacionesModule, CertificadosModule],
  controllers: [CursosController],
  providers: [CursosService],
})
export class CursosModule {}

