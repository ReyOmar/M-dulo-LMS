import { Module } from '@nestjs/common';
import { PesvBridgeService } from './pesv-bridge.service';
import { PesvBridgeController } from './pesv-bridge.controller';
import { PesvPrismaService } from './pesv-prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MatriculasModule } from '../matriculas/matriculas.module';
import { WsModule } from '../ws/ws.module';
import { MailModule } from '../mail/mail.module';

/**
 * PesvBridgeModule — Self-contained integration module for PESV ↔ LMS.
 *
 * This module is completely isolated from both PESV-be and LMS core:
 * - Does NOT modify PESV-be code or database (readonly access)
 * - Only imports existing LMS services through their public module APIs
 * - Can be disabled entirely by setting PESV_BRIDGE_ENABLED=false
 *
 * Note: ScheduleModule.forRoot() is already registered by SchedulerModule,
 * so we don't need to import it here. The @Cron decorators just work.
 */
@Module({
  imports: [PrismaModule, MatriculasModule, WsModule, MailModule],
  controllers: [PesvBridgeController],
  providers: [PesvBridgeService, PesvPrismaService],
  exports: [PesvBridgeService],
})
export class PesvBridgeModule {}
