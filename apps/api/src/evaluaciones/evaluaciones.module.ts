import { Module } from '@nestjs/common';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { CertificadosModule } from '../certificados/certificados.module';

@Module({
  imports: [PrismaModule, StorageModule, NotificacionesModule, CertificadosModule],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService]
})
export class EvaluacionesModule {}

