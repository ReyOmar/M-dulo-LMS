import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  ForbiddenException,
  Delete,
  BadRequestException,
  Req,
} from '@nestjs/common';
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
    await this.tokenBlacklistService.revokeUser(user.sub);
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

  @Roles('ADMINISTRADOR')
  @Post('usuarios/crear')
  async createUser(@Body() body: { nombre: string; apellido: string; email: string; rol: string }) {
    return this.userService.createUser(body);
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

  // ── Profile photo management (Fastify multipart) ──

  @Post('perfil/:guid/foto')
  async uploadPhoto(@Param('guid') guid: string, @CurrentUser() user: JwtPayload, @Req() req: any) {
    if (user && user.sub !== guid && user.role !== 'ADMINISTRADOR') {
      throw new ForbiddenException('No tienes permiso para modificar este perfil.');
    }
    const data = await req.file();
    if (!data) throw new BadRequestException('No se recibió ningún archivo.');

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) throw new BadRequestException('El archivo está vacío.');

    return this.userService.uploadProfilePhoto(guid, buffer, data.filename || 'avatar.png');
  }

  @Delete('perfil/:guid/foto')
  async deletePhoto(@Param('guid') guid: string, @CurrentUser() user: JwtPayload) {
    if (user && user.sub !== guid && user.role !== 'ADMINISTRADOR') {
      throw new ForbiddenException('No tienes permiso para modificar este perfil.');
    }
    return this.userService.deleteProfilePhoto(guid);
  }

  // ── Email verification (for access requests) ──

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('verificar-email')
  async verifyEmail(@Body() body: { email: string }) {
    return this.authService.sendEmailVerification(body.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('confirmar-email')
  async confirmEmail(@Body() body: { email: string; codigo: string }) {
    return this.authService.confirmEmailVerification(body.email, body.codigo);
  }
}
