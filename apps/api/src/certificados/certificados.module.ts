import { Module } from '@nestjs/common';
import { CertificadosService } from './certificados.service';
import { CertificadosController } from './certificados.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WsModule } from '../ws/ws.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, WsModule, ConfiguracionModule, NotificacionesModule, StorageModule],
  controllers: [CertificadosController],
  providers: [CertificadosService],
  exports: [CertificadosService],
})
export class CertificadosModule {}
