"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ConfiguracionService", {
    enumerable: true,
    get: function() {
        return ConfiguracionService;
    }
});
const _common = require("@nestjs/common");
const _prismaservice = require("../prisma/prisma.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let ConfiguracionService = class ConfiguracionService {
    async onModuleInit() {
        await this.ensureConfig();
    }
    async ensureConfig() {
        const config = await this.prisma.lms_configuracion.findUnique({
            where: {
                id: 1
            }
        });
        if (!config) {
            await this.prisma.lms_configuracion.create({
                data: {
                    id: 1,
                    nombre_plataforma: 'PESV Education',
                    color_primario: '#1e3a8a',
                    color_secundario: '#ea580c',
                    fuente: 'Inter',
                    border_radius: 12,
                    mensaje_bienvenida: 'Bienvenido PESV',
                    idioma: 'es'
                }
            });
        }
    }
    async getConfig() {
        return this.prisma.lms_configuracion.findUnique({
            where: {
                id: 1
            }
        });
    }
    async updateConfig(dto) {
        return this.prisma.lms_configuracion.update({
            where: {
                id: 1
            },
            data: dto
        });
    }
    constructor(prisma){
        this.prisma = prisma;
    }
};
ConfiguracionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _prismaservice.PrismaService === "undefined" ? Object : _prismaservice.PrismaService
    ])
], ConfiguracionService);

//# sourceMappingURL=configuracion.service.js.map