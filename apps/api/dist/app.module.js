"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AppModule", {
    enumerable: true,
    get: function() {
        return AppModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _configuracionmodule = require("./configuracion/configuracion.module");
const _prismamodule = require("./prisma/prisma.module");
const _authmodule = require("./auth/auth.module");
const _cursosmodule = require("./cursos/cursos.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let AppModule = class AppModule {
};
AppModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _config.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: [
                    '../../.env'
                ]
            }),
            _configuracionmodule.ConfiguracionModule,
            _prismamodule.PrismaModule,
            _authmodule.AuthModule,
            _cursosmodule.CursosModule
        ],
        controllers: [],
        providers: []
    })
], AppModule);

//# sourceMappingURL=app.module.js.map