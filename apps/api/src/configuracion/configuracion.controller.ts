import { Controller, Get, Post, Body } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Public() // Theme/branding config is needed before login
  @Get()
  getConfig() {
    return this.configuracionService.getConfig();
  }

  @Post() // Protected by default — requires JWT (admin only)
  updateConfig(@Body() body: any) {
    return this.configuracionService.updateConfig(body);
  }
}
