import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Global()
@Module({
  imports: [PrismaModule, ConfiguracionModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
