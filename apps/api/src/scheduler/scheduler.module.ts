import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, NotificacionesModule, StorageModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
