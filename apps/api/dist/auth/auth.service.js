"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AuthService", {
    enumerable: true,
    get: function() {
        return AuthService;
    }
});
const _common = require("@nestjs/common");
const _prismaservice = require("../prisma/prisma.service");
const _bcryptjs = /*#__PURE__*/ _interop_require_wildcard(require("bcryptjs"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AuthService = class AuthService {
    async requestAccess(dto) {
        // Check if user already exists
        const existingUser = await this.prisma.usuarios.findUnique({
            where: {
                email: dto.email
            }
        });
        if (existingUser) {
            throw new _common.BadRequestException('El usuario ya existe en el sistema.');
        }
        // Check if request already exists
        const existingReq = await this.prisma.lms_solicitudes_acceso.findUnique({
            where: {
                email: dto.email
            }
        });
        if (existingReq) {
            throw new _common.BadRequestException('Ya existe una solicitud pendiente con este correo.');
        }
        const sol = await this.prisma.lms_solicitudes_acceso.create({
            data: {
                email: dto.email,
                nombre: dto.nombre,
                apellido: dto.apellido,
                rol_pedido: dto.rol_pedido
            }
        });
        return {
            message: 'Solicitud enviada al administrador exitosamente.',
            request_id: sol.id
        };
    }
    async login(email, contrasena) {
        const user = await this.prisma.usuarios.findUnique({
            where: {
                email
            }
        });
        if (!user) {
            throw new _common.UnauthorizedException('Credenciales inválidas.');
        }
        if (!contrasena) {
            throw new _common.UnauthorizedException('Contraseña requerida.');
        }
        // Si la contraseña es NULL, fuerza configuración
        if (!user.contrasena) {
            return {
                requireSetup: true,
                message: 'Cuenta aprobada. Por favor, crea tu contraseña segura.',
                user: {
                    email: user.email,
                    nombre: user.nombre
                }
            };
        }
        const isValid = await _bcryptjs.compare(contrasena, user.contrasena);
        if (!isValid) {
            throw new _common.UnauthorizedException('Credenciales inválidas.');
        }
        // Si la contraseña es la predeterminada (pesvauth2026), fuerza configuración
        if (contrasena === 'pesvauth2026') {
            return {
                requireSetup: true,
                message: 'Estás usando la contraseña temporal. Por favor, crea tu contraseña segura.',
                user: {
                    email: user.email,
                    nombre: user.nombre
                }
            };
        }
        // Generate dummy JWT for UI
        const token = Buffer.from(JSON.stringify({
            guid: user.guid,
            role: user.rol,
            email: user.email
        })).toString('base64');
        return {
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                guid: user.guid,
                role: user.rol,
                nombre: user.nombre,
                apellido: user.apellido
            }
        };
    }
    async setupPassword(email, nuevaContrasena) {
        const user = await this.prisma.usuarios.findUnique({
            where: {
                email
            }
        });
        if (!user) {
            throw new _common.NotFoundException('Usuario no existe.');
        }
        if (user.contrasena) {
            const isDefault = await _bcryptjs.compare('pesvauth2026', user.contrasena);
            if (!isDefault) {
                throw new _common.BadRequestException('La cuenta ya tiene una contraseña configurada y no es la temporal.');
            }
        }
        const hashed = await _bcryptjs.hash(nuevaContrasena, 10);
        await this.prisma.usuarios.update({
            where: {
                email
            },
            data: {
                contrasena: hashed
            }
        });
        return {
            message: 'Contraseña establecida exitosamente.'
        };
    }
    // --- MÉTODOS DE ADMINISTRADOR ---
    async getAllUsers() {
        return this.prisma.usuarios.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
    }
    async getPendingRequests() {
        return this.prisma.lms_solicitudes_acceso.findMany({
            where: {
                estado: 'PENDIENTE'
            },
            orderBy: {
                created_at: 'desc'
            }
        });
    }
    async approveRequest(id) {
        const request = await this.prisma.lms_solicitudes_acceso.findUnique({
            where: {
                id
            }
        });
        if (!request) throw new _common.NotFoundException('Solicitud no encontrada.');
        if (request.estado !== 'PENDIENTE') throw new _common.BadRequestException('La solicitud ya fue procesada.');
        // Asignamos la clave por defecto
        const hashedDefault = await _bcryptjs.hash('pesvauth2026', 10);
        await this.prisma.$transaction([
            this.prisma.lms_solicitudes_acceso.update({
                where: {
                    id
                },
                data: {
                    estado: 'ACEPTADA'
                }
            }),
            this.prisma.usuarios.create({
                data: {
                    email: request.email,
                    nombre: request.nombre,
                    apellido: request.apellido,
                    rol: request.rol_pedido,
                    contrasena: hashedDefault
                }
            })
        ]);
        return {
            message: 'Solicitud aprobada y usuario creado con clave temporal.'
        };
    }
    async rejectRequest(id) {
        const request = await this.prisma.lms_solicitudes_acceso.findUnique({
            where: {
                id
            }
        });
        if (!request) throw new _common.NotFoundException('Solicitud no encontrada.');
        if (request.estado !== 'PENDIENTE') throw new _common.BadRequestException('La solicitud ya fue procesada.');
        await this.prisma.lms_solicitudes_acceso.update({
            where: {
                id
            },
            data: {
                estado: 'RECHAZADA'
            }
        });
        return {
            message: 'Solicitud rechazada.'
        };
    }
    constructor(prisma){
        this.prisma = prisma;
    }
};
AuthService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _prismaservice.PrismaService === "undefined" ? Object : _prismaservice.PrismaService
    ])
], AuthService);

//# sourceMappingURL=auth.service.js.map