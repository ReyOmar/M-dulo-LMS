"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ConfiguracionController", {
    enumerable: true,
    get: function() {
        return ConfiguracionController;
    }
});
const _common = require("@nestjs/common");
const _configuracionservice = require("./configuracion.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let ConfiguracionController = class ConfiguracionController {
    getConfig() {
        return this.configuracionService.getConfig();
    }
    updateConfig(body) {
        return this.configuracionService.updateConfig(body);
    }
    constructor(configuracionService){
        this.configuracionService = configuracionService;
    }
};
_ts_decorate([
    (0, _common.Get)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], ConfiguracionController.prototype, "getConfig", null);
_ts_decorate([
    (0, _common.Post)(),
    _ts_param(0, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Object
    ]),
    _ts_metadata("design:returntype", void 0)
], ConfiguracionController.prototype, "updateConfig", null);
ConfiguracionController = _ts_decorate([
    (0, _common.Controller)('configuracion'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _configuracionservice.ConfiguracionService === "undefined" ? Object : _configuracionservice.ConfiguracionService
    ])
], ConfiguracionController);

//# sourceMappingURL=configuracion.controller.js.map