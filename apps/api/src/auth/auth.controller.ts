import { Controller, Post, Body, Get, Param, Patch, ForbiddenException, Delete } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { SolicitarAccesoDto } from './dto/solicitar-acceso.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  // ── Public auth endpoints ──

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('solicitar')
  async requestAccess(@Body() dto: SolicitarAccesoDto) {
    return this.authService.requestAccess(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.contrasena);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('establecer-password')
  async setupPassword(@Body() body: SetupPasswordDto) {
    return this.authService.setupPassword(body.email, body.contrasenaTemporal, body.nuevaContrasena);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('recuperar-contrasena')
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('restablecer-contrasena')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.nuevaContrasena);
  }

  // ── Session management ──

  @Post('logout')
  async logout(@CurrentUser() user: JwtPayload) {
    this.tokenBlacklistService.revokeUser(user.sub);
    return { message: 'Sesión cerrada correctamente.' };
  }

  // ── User profile (delegated to UserService) ──

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    if (!user) throw new ForbiddenException('No autenticado');
    return this.userService.getUserProfile(user.sub);
  }

  @Get('perfil/:guid')
  async getProfile(@Param('guid') guid: string, @CurrentUser() user: JwtPayload) {
    if (user && user.sub !== guid && user.role !== 'ADMINISTRADOR') {
      throw new ForbiddenException('No tienes permiso para ver este perfil.');
    }
    return this.userService.getUserProfile(guid);
  }

  @Patch('perfil/:guid')
  async updateProfile(@Param('guid') guid: string, @Body() dto: UpdateProfileDto, @CurrentUser() user: JwtPayload) {
    if (user && user.sub !== guid && user.role !== 'ADMINISTRADOR') {
      throw new ForbiddenException('No tienes permiso para modificar este perfil.');
    }
    return this.userService.updateProfile(guid, dto);
  }

  // ── Admin user management (delegated to UserService) ──

  @Roles('ADMINISTRADOR')
  @Get('usuarios')
  async getAllUsers() {
    return this.userService.getAllUsers();
  }

  @Roles('ADMINISTRADOR')
  @Get('admin-stats')
  async getAdminStats() {
    return this.userService.getAdminStats();
  }

  @Roles('ADMINISTRADOR')
  @Delete('usuarios/:guid')
  async deleteUser(@Param('guid') guid: string, @CurrentUser() currentUser: any) {
    return this.userService.deleteUser(guid, currentUser?.sub);
  }

  // ── Access request management ──

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
