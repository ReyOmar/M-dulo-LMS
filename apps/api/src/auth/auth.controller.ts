import { Controller, Post, Body, Get, Param, Patch, ForbiddenException, Delete } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { SolicitarAccesoDto } from './dto/solicitar-acceso.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 access requests per minute
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
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 attempts per minute
  @Post('establecer-password')
  async setupPassword(@Body() body: SetupPasswordDto) {
    return this.authService.setupPassword(body.email, body.contrasenaTemporal, body.nuevaContrasena);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 reset requests per minute
  @Post('recuperar-contrasena')
  async requestPasswordReset(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 reset attempts per minute
  @Post('restablecer-contrasena')
  async resetPassword(@Body() body: { token: string; nuevaContrasena: string }) {
    return this.authService.resetPassword(body.token, body.nuevaContrasena);
  }

  // --- PERFIL DE USUARIO (autenticado) ---

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    if (!user) throw new ForbiddenException('No autenticado');
    return this.authService.getUserProfile(user.sub);
  }

  @Get('perfil/:guid')
  async getProfile(@Param('guid') guid: string, @CurrentUser() user: JwtPayload) {
    // When JWT is available, enforce ownership; otherwise allow access by guid
    if (user && user.sub !== guid && user.role !== 'ADMINISTRADOR') {
      throw new ForbiddenException('No tienes permiso para ver este perfil.');
    }
    return this.authService.getUserProfile(guid);
  }

  @Patch('perfil/:guid')
  async updateProfile(@Param('guid') guid: string, @Body() dto: UpdateProfileDto, @CurrentUser() user: JwtPayload) {
    if (user && user.sub !== guid && user.role !== 'ADMINISTRADOR') {
      throw new ForbiddenException('No tienes permiso para modificar este perfil.');
    }
    return this.authService.updateProfile(guid, dto);
  }

  // --- RUTAS DE ADMINISTRADOR (autenticado — future: add @Roles('ADMINISTRADOR')) ---

  @Roles('ADMINISTRADOR')
  @Get('usuarios')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Roles('ADMINISTRADOR')
  @Get('admin-stats')
  async getAdminStats() {
    return this.authService.getAdminStats();
  }

  @Roles('ADMINISTRADOR')
  @Delete('usuarios/:guid')
  async deleteUser(@Param('guid') guid: string, @CurrentUser() currentUser: any) {
    return this.authService.deleteUser(guid, currentUser?.sub);
  }

  @Roles('ADMINISTRADOR')
  @Get('solicitudes')
  async getPendingRequests() {
    return this.authService.getPendingRequests();
  }

  @Roles('ADMINISTRADOR')
  @Post('solicitudes/:id/aprobar')
  async approveRequest(@Param('id') id: string) {
    const result = await this.authService.approveRequest(parseInt(id, 10));
    this.authService.notifyRequestResolved('approved', { id: parseInt(id, 10) });
    return result;
  }

  @Roles('ADMINISTRADOR')
  @Post('solicitudes/:id/rechazar')
  async rejectRequest(@Param('id') id: string) {
    const result = await this.authService.rejectRequest(parseInt(id, 10));
    this.authService.notifyRequestResolved('rejected', { id: parseInt(id, 10) });
    return result;
  }
}
