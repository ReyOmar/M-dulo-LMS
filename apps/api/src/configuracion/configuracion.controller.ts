import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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

  @Public()
  @Get('/landing')
  getLandingConfig() {
    return this.configuracionService.getLandingConfig();
  }

  @Roles('ADMINISTRADOR')
  @Get('/certificados')
  getCertConfig() {
    return this.configuracionService.getCertConfig();
  }

  @Roles('ADMINISTRADOR')
  @Post('/certificados')
  updateCertConfig(@Body() body: any) {
    return this.configuracionService.updateCertConfig(body);
  }

  // ── Examiner Firma Endpoints ──

  @Get('/firma')
  getFirma(@CurrentUser() user: any, @Query('usuario_guid') usuario_guid?: string) {
    const guid = user?.guid || usuario_guid;
    return this.configuracionService.getFirma(guid);
  }

  @Post('/firma')
  updateFirma(
    @CurrentUser() user: any,
    @Body() body: { firma_url?: string; firma_nombre?: string; firma_cargo?: string },
    @Query('usuario_guid') usuario_guid?: string,
  ) {
    const guid = user?.guid || usuario_guid;
    return this.configuracionService.updateFirma(guid, body);
  }

  // Admin: get examiner firma for a specific course (for preview)
  @Roles('ADMINISTRADOR')
  @Get('/firma/curso/:curso_guid')
  getFirmaPorCurso(@Param('curso_guid') curso_guid: string) {
    return this.configuracionService.getFirmaPorCurso(curso_guid);
  }
}
