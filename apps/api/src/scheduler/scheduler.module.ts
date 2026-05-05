import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, NotificacionesModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
