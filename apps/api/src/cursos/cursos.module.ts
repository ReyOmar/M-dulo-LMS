import { Module } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { CursosController } from './cursos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, NotificacionesModule],
  controllers: [CursosController],
  providers: [CursosService],
})
export class CursosModule {}

