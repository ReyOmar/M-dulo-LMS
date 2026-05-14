import { Module, Global, forwardRef } from '@nestjs/common';
import { LmsGateway } from './lms.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  providers: [LmsGateway],
  exports: [LmsGateway],
})
export class WsModule {}
