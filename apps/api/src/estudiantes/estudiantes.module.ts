import { Module } from '@nestjs/common';
import { EstudiantesController } from './estudiantes.controller';
import { EstudiantesService } from './estudiantes.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CertificadosModule } from '../certificados/certificados.module';

@Module({
  imports: [PrismaModule, CertificadosModule],
  controllers: [EstudiantesController],
  providers: [EstudiantesService]
})
export class EstudiantesModule {}
