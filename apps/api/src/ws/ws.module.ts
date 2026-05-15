import { Module, Global, forwardRef } from '@nestjs/common';
import { LmsGateway } from './lms.gateway';
import { WsTokenService } from './ws-token.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  providers: [LmsGateway, WsTokenService],
  exports: [LmsGateway, WsTokenService],
})
export class WsModule {}
