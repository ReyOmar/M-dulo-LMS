import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { SolicitarAccesoDto } from './dto/solicitar-acceso.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('solicitar')
  async requestAccess(@Body() dto: SolicitarAccesoDto) {
    return this.authService.requestAccess(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // Stricter: 5 login attempts per minute
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.contrasena);
  }

  @Public()
  @Post('establecer-password')
  async setupPassword(@Body() body: { email: string; nuevaContrasena: string }) {
    return this.authService.setupPassword(body.email, body.nuevaContrasena);
  }

  // --- PERFIL DE USUARIO (autenticado) ---

  @Get('perfil/:guid')
  async getProfile(@Param('guid') guid: string) {
    return this.authService.getUserProfile(guid);
  }

  @Patch('perfil/:guid')
  async updateProfile(@Param('guid') guid: string, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(guid, dto);
  }

  // --- RUTAS DE ADMINISTRADOR (autenticado — future: add @Roles('ADMINISTRADOR')) ---

  @Get('usuarios')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Get('solicitudes')
  async getPendingRequests() {
    return this.authService.getPendingRequests();
  }

  @Post('solicitudes/:id/aprobar')
  async approveRequest(@Param('id') id: string) {
    return this.authService.approveRequest(parseInt(id, 10));
  }

  @Post('solicitudes/:id/rechazar')
  async rejectRequest(@Param('id') id: string) {
    return this.authService.rejectRequest(parseInt(id, 10));
  }
}
