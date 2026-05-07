import { IsString, IsNotEmpty } from 'class-validator';

export class HeartbeatDto {
  @IsString() @IsNotEmpty()
  curso_guid: string;
}
