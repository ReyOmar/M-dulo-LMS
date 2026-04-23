"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CursosController", {
    enumerable: true,
    get: function() {
        return CursosController;
    }
});
const _common = require("@nestjs/common");
const _cursosservice = require("./cursos.service");
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
let CursosController = class CursosController {
    async getCursos(role, profesor_guid, usuario_guid) {
        if (role === 'admin') {
            return this.cursosService.getAllCursosParaAdmin();
        }
        if (role === 'teacher' && profesor_guid) {
            return this.cursosService.getCursosDeProfesor(profesor_guid);
        }
        if (role === 'student' && usuario_guid) {
            return this.cursosService.getCursosDeEstudiante(usuario_guid);
        }
        return this.cursosService.getCursosActivosParaEstudiante();
    }
    async addBloque(modulo_guid, body) {
        return this.cursosService.addBloqueToModulo(modulo_guid, body);
    }
    async editModulo(modulo_guid, body) {
        return this.cursosService.updateModulo(modulo_guid, body);
    }
    async editBloque(id, body) {
        return this.cursosService.updateBloque(id, body);
    }
    async removeBloque(id) {
        return this.cursosService.deleteBloque(id);
    }
    async getCursoDetalle(id) {
        return this.cursosService.getCursoDetalleCompleto(id);
    }
    async createCurso(body) {
        return this.cursosService.createCurso(body);
    }
    async editCurso(curso_guid, body) {
        return this.cursosService.updateCurso(curso_guid, body);
    }
    async createModulo(curso_guid, body) {
        return this.cursosService.createModuloParaCurso(curso_guid, body);
    }
    async entregarTarea(tareaId, body) {
        return this.cursosService.submitEntrega(tareaId, body);
    }
    async getEntrega(tareaId, usuario_guid) {
        return this.cursosService.getEntrega(tareaId, usuario_guid);
    }
    async getTodasEntregas(tareaId) {
        return this.cursosService.getTodasEntregasParaTarea(tareaId);
    }
    async getProfesores() {
        return this.cursosService.getProfesores();
    }
    async asignarCurso(curso_guid, body) {
        return this.cursosService.asignarCurso(curso_guid, body.profesor_guid);
    }
    constructor(cursosService){
        this.cursosService = cursosService;
    }
};
_ts_decorate([
    (0, _common.Get)(),
    _ts_param(0, (0, _common.Query)('role')),
    _ts_param(1, (0, _common.Query)('profesor_guid')),
    _ts_param(2, (0, _common.Query)('usuario_guid')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        String,
        String
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "getCursos", null);
_ts_decorate([
    (0, _common.Post)('/modulos/:moduloId/bloques'),
    _ts_param(0, (0, _common.Param)('moduloId')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "addBloque", null);
_ts_decorate([
    (0, _common.Patch)('/modulos/:moduloId'),
    _ts_param(0, (0, _common.Param)('moduloId')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "editModulo", null);
_ts_decorate([
    (0, _common.Patch)('/bloques/:id'),
    _ts_param(0, (0, _common.Param)('id')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "editBloque", null);
_ts_decorate([
    (0, _common.Delete)('/bloques/:id'),
    _ts_param(0, (0, _common.Param)('id')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "removeBloque", null);
_ts_decorate([
    (0, _common.Get)(':id'),
    _ts_param(0, (0, _common.Param)('id')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "getCursoDetalle", null);
_ts_decorate([
    (0, _common.Post)(),
    _ts_param(0, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "createCurso", null);
_ts_decorate([
    (0, _common.Patch)(':id'),
    _ts_param(0, (0, _common.Param)('id')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "editCurso", null);
_ts_decorate([
    (0, _common.Post)(':id/modulos'),
    _ts_param(0, (0, _common.Param)('id')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "createModulo", null);
_ts_decorate([
    (0, _common.Post)('/tareas/:tareaId/entregas'),
    _ts_param(0, (0, _common.Param)('tareaId')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "entregarTarea", null);
_ts_decorate([
    (0, _common.Get)('/tareas/:tareaId/entregas'),
    _ts_param(0, (0, _common.Param)('tareaId')),
    _ts_param(1, (0, _common.Query)('usuario_guid')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        String
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "getEntrega", null);
_ts_decorate([
    (0, _common.Get)('/tareas/:tareaId/todas-entregas'),
    _ts_param(0, (0, _common.Param)('tareaId')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "getTodasEntregas", null);
_ts_decorate([
    (0, _common.Get)('/profesores'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "getProfesores", null);
_ts_decorate([
    (0, _common.Post)(':id/asignar'),
    _ts_param(0, (0, _common.Param)('id')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], CursosController.prototype, "asignarCurso", null);
CursosController = _ts_decorate([
    (0, _common.Controller)('cursos'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _cursosservice.CursosService === "undefined" ? Object : _cursosservice.CursosService
    ])
], CursosController);

//# sourceMappingURL=cursos.controller.js.map