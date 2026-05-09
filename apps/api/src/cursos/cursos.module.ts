import { Module } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { QuizService } from './quiz.service';
import { BloqueService } from './bloque.service';
import { CursosController } from './cursos.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CursosController],
  providers: [CursosService, QuizService, BloqueService],
  exports: [CursosService, QuizService, BloqueService],
})
export class CursosModule {}
