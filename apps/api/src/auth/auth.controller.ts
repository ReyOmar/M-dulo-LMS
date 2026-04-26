import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('solicitar')
  async requestAccess(@Body() body: { email: string; nombre: string; apellido: string; rol_pedido: any }) {
    return this.authService.requestAccess(body);
  }

  @Post('login')
  async login(@Body() body: { email: string; contrasena?: string }) {
    return this.authService.login(body.email, body.contrasena);
  }

  @Post('establecer-password')
  async setupPassword(@Body() body: { email: string; nuevaContrasena: string }) {
    return this.authService.setupPassword(body.email, body.nuevaContrasena);
  }

  // --- PERFIL DE USUARIO ---

  @Get('perfil/:guid')
  async getProfile(@Param('guid') guid: string) {
    return this.authService.getUserProfile(guid);
  }

  @Patch('perfil/:guid')
  async updateProfile(@Param('guid') guid: string, @Body() body: any) {
    return this.authService.updateProfile(guid, body);
  }

  // --- RUTAS DE ADMINISTRADOR ---

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
