import { Controller, Get, Post, Body } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';

@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Public() // Theme/branding config is needed before login
  @Get()
  getConfig() {
    return this.configuracionService.getConfig();
  }

  @Roles('ADMINISTRADOR')
  @Post() // Protected by default — requires JWT (admin only)
  updateConfig(@Body() body: UpdateConfiguracionDto) {
    return this.configuracionService.updateConfig(body);
  }
}
