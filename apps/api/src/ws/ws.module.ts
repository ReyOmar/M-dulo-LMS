import { Module, Global } from '@nestjs/common';
import { LmsGateway } from './lms.gateway';

@Global()
@Module({
  providers: [LmsGateway],
  exports: [LmsGateway],
})
export class WsModule {}
