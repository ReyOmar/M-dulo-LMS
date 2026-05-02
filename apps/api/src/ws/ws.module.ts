import { Module, Global } from '@nestjs/common';
import { LmsGateway } from './lms.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [LmsGateway],
  exports: [LmsGateway],
})
export class WsModule {}
