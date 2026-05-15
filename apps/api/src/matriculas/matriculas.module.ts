import { Module } from '@nestjs/common';
import { MatriculasController } from './matriculas.controller';
import { MatriculasService } from './matriculas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [MatriculasController],
  providers: [MatriculasService],
})
export class MatriculasModule {}
