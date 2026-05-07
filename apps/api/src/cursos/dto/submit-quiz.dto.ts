import { IsObject } from 'class-validator';

export class SubmitQuizDto {
  @IsObject()
  respuestas: Record<string, string>;
}
