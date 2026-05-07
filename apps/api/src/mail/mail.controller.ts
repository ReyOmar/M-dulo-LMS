import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { MailService } from './mail.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  asunto?: string;

  @IsOptional()
  @IsString()
  cuerpo_html?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

@Controller('mail-templates')
@UseGuards(RolesGuard)
@Roles('ADMINISTRADOR')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('eventos')
  async getAllEventos() {
    return this.mailService.getAllEventos();
  }

  @Put(':id')
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.mailService.updateTemplate(Number(id), dto);
  }
}
