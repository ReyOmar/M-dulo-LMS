import { Controller, Get, Post, Body } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';

@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  getConfig() {
    return this.configuracionService.getConfig();
  }

  @Post()
  updateConfig(@Body() body: any) {
    return this.configuracionService.updateConfig(body);
  }
}
