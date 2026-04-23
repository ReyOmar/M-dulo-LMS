"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CursosService", {
    enumerable: true,
    get: function() {
        return CursosService;
    }
});
const _common = require("@nestjs/common");
const _prismaservice = require("../prisma/prisma.service");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
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
const UPLOADS_DIR = _path.join(process.cwd(), 'uploads');
let CursosService = class CursosService {
    async getCursosActivosParaEstudiante() {
        return this.prisma.lms_cursos.findMany({
            where: {
                estado: 'PUBLICADO'
            },
            orderBy: {
                created_at: 'desc'
            }
        });
    }
    async getAllCursosParaAdmin() {
        return this.prisma.lms_cursos.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
    }
    async getProfesores() {
        return this.prisma.usuarios.findMany({
            where: {
                rol: 'PROFESOR'
            },
            select: {
                guid: true,
                nombre: true,
                apellido: true,
                email: true
            }
        });
    }
    async asignarCurso(curso_guid, profesor_guid) {
        return this.prisma.lms_cursos.update({
            where: {
                guid: curso_guid
            },
            data: {
                profesor_guid
            }
        });
    }
    async getCursosDeProfesor(profesor_guid) {
        return this.prisma.lms_cursos.findMany({
            where: {
                profesor_guid,
                estado: 'PUBLICADO'
            },
            orderBy: {
                created_at: 'desc'
            }
        });
    }
    async getCursosDeEstudiante(estudiante_guid) {
        const matriculas = await this.prisma.lms_matriculas.findMany({
            where: {
                usuario_guid: estudiante_guid
            },
            include: {
                curso: true
            },
            orderBy: {
                fecha_matricula: 'desc'
            }
        });
        return matriculas.map((m)=>m.curso);
    }
    async getCursoDetalleCompleto(curso_guid) {
        const curso = await this.prisma.lms_cursos.findUnique({
            where: {
                guid: curso_guid
            },
            include: {
                modulos: {
                    orderBy: {
                        orden: 'asc'
                    },
                    include: {
                        lecciones: {
                            include: {
                                recursos: {
                                    orderBy: {
                                        orden: 'asc'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!curso) throw new _common.NotFoundException('Curso no encontrado');
        return curso;
    }
    async createCurso(data) {
        let guidFinal = data.profesor_guid;
        // Si no hay profesor_guid proporcionado, asignar al primer admin/profesor disponible
        if (!guidFinal) {
            const fallBackAdmin = await this.prisma.usuarios.findFirst({
                where: {
                    rol: {
                        in: [
                            'ADMINISTRADOR',
                            'PROFESOR'
                        ]
                    }
                }
            });
            if (fallBackAdmin) guidFinal = fallBackAdmin.guid;
        }
        return this.prisma.lms_cursos.create({
            data: {
                titulo: data.titulo,
                estado: 'BORRADOR',
                profesor_guid: guidFinal
            }
        });
    }
    async updateCurso(curso_guid, data) {
        return this.prisma.lms_cursos.update({
            where: {
                guid: curso_guid
            },
            data: {
                titulo: data.titulo,
                estado: data.estado
            }
        });
    }
    async createModuloParaCurso(curso_guid, data) {
        // Verificar si el curso existe
        const curso = await this.prisma.lms_cursos.findUnique({
            where: {
                guid: curso_guid
            }
        });
        if (!curso) throw new _common.NotFoundException('Curso no encontrado');
        const orden = data.orden ?? await this.prisma.lms_modulos.count({
            where: {
                curso_guid
            }
        });
        // Transaction: Creates a modulo and historically required 'leccion' in one go
        return this.prisma.$transaction(async (tx)=>{
            const modulo = await tx.lms_modulos.create({
                data: {
                    curso_guid,
                    titulo: data.titulo,
                    orden
                }
            });
            // Crear una lección interna en blanco obligatoria por el schema
            await tx.lms_lecciones.create({
                data: {
                    modulo_guid: modulo.guid,
                    titulo: 'Lección Interna Módulo ' + modulo.guid,
                    orden: 0
                }
            });
            return modulo;
        });
    }
    async updateModulo(modulo_guid, data) {
        return this.prisma.lms_modulos.update({
            where: {
                guid: modulo_guid
            },
            data: {
                titulo: data.titulo
            }
        });
    }
    async getBloque(guid) {
        const bloque = await this.prisma.lms_recursos.findUnique({
            where: {
                guid
            }
        });
        if (!bloque) throw new _common.NotFoundException('Recurso no encontrado');
        return bloque;
    }
    async addBloqueToModulo(modulo_guid, data) {
        const modulo = await this.prisma.lms_modulos.findUnique({
            where: {
                guid: modulo_guid
            },
            include: {
                lecciones: true
            }
        });
        if (!modulo) throw new _common.NotFoundException('Módulo no encontrado');
        if (!modulo.lecciones || modulo.lecciones.length === 0) {
            throw new _common.BadRequestException('Módulo corrupto sin lección interna base.');
        }
        const leccion_guid = modulo.lecciones[0].guid;
        const count = await this.prisma.lms_recursos.count({
            where: {
                leccion_guid
            }
        });
        return this.prisma.lms_recursos.create({
            data: {
                leccion_guid,
                titulo: data.titulo || 'Bloque',
                tipo: data.tipo,
                contenido_html: data.contenido_html,
                orden: count,
                obligatorio: true
            }
        });
    }
    async updateBloque(guid, data) {
        return this.prisma.lms_recursos.update({
            where: {
                guid
            },
            data: {
                titulo: data.titulo,
                contenido_html: data.contenido_html,
                url_archivo: data.url_archivo,
                url_referencia: data.url_referencia,
                archivo_adjunto: data.archivo_adjunto,
                archivo_adjunto_nombre: data.archivo_adjunto_nombre,
                quiz_config: data.quiz_config,
                archivo_max_size_mb: data.archivo_max_size_mb
            }
        });
    }
    // Save a base64 file to disk and return the filename
    uploadFile(base64Data, originalName) {
        const ext = _path.extname(originalName) || '.bin';
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        // Remove data:xxx;base64, prefix if present
        const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const buffer = Buffer.from(base64Clean, 'base64');
        _fs.writeFileSync(_path.join(UPLOADS_DIR, uniqueName), buffer);
        return uniqueName;
    }
    getUploadPath(filename) {
        const fullPath = _path.join(UPLOADS_DIR, filename);
        if (!_fs.existsSync(fullPath)) throw new _common.NotFoundException('Archivo no encontrado');
        return fullPath;
    }
    async submitEntrega(tarea_guid, data) {
        // 1. Upload file to disk
        const serverFilename = this.uploadFile(data.base64, data.nombre_archivo);
        // 2. Verificar si hay un registro de entrega previo
        let entrega = await this.prisma.lms_entregas.findFirst({
            where: {
                tarea_guid,
                usuario_guid: data.usuario_guid
            }
        });
        if (entrega) {
            entrega = await this.prisma.lms_entregas.update({
                where: {
                    guid: entrega.guid
                },
                data: {
                    url_archivo_adjunto: serverFilename,
                    respuesta_texto: data.nombre_archivo,
                    estado: 'ENTREGADA',
                    fecha_entrega: new Date()
                }
            });
        } else {
            entrega = await this.prisma.lms_entregas.create({
                data: {
                    tarea_guid,
                    usuario_guid: data.usuario_guid,
                    url_archivo_adjunto: serverFilename,
                    respuesta_texto: data.nombre_archivo,
                    estado: 'ENTREGADA'
                }
            });
        }
        return entrega;
    }
    async getEntrega(tarea_guid, usuario_guid) {
        return this.prisma.lms_entregas.findFirst({
            where: {
                tarea_guid,
                usuario_guid
            },
            select: {
                guid: true,
                estado: true,
                fecha_entrega: true,
                respuesta_texto: true,
                url_archivo_adjunto: true
            }
        });
    }
    async getTodasEntregasParaTarea(tarea_guid) {
        return this.prisma.lms_entregas.findMany({
            where: {
                tarea_guid
            },
            select: {
                guid: true,
                estado: true,
                fecha_entrega: true,
                respuesta_texto: true,
                usuario_guid: true
            },
            orderBy: {
                fecha_entrega: 'desc'
            }
        });
    }
    async deleteBloque(guid) {
        return this.prisma.lms_recursos.delete({
            where: {
                guid
            }
        });
    }
    async deleteModulo(guid) {
        return this.prisma.lms_modulos.delete({
            where: {
                guid
            }
        });
    }
    async deleteCurso(guid) {
        return this.prisma.lms_cursos.delete({
            where: {
                guid
            }
        });
    }
    // --- EXAMINER METHODS ---
    async getMonitoreoEstudiantes(profesor_guid) {
        // 1. Get courses assigned to this professor
        const cursos = await this.prisma.lms_cursos.findMany({
            where: {
                profesor_guid
            },
            include: {
                modulos: {
                    include: {
                        lecciones: {
                            include: {
                                recursos: {
                                    select: {
                                        guid: true,
                                        tipo: true,
                                        titulo: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (cursos.length === 0) return [];
        // 2. Get all entregas for these courses' resources
        const allResourceGuids = [];
        const cursoResourceMap = {};
        for (const curso of cursos){
            for (const mod of curso.modulos){
                const recursos = mod.lecciones.flatMap((l)=>l.recursos);
                for (const r of recursos){
                    allResourceGuids.push(r.guid);
                    if (!cursoResourceMap[r.guid]) cursoResourceMap[r.guid] = [];
                    cursoResourceMap[r.guid].push({
                        curso_guid: curso.guid,
                        curso_titulo: curso.titulo,
                        modulo_titulo: mod.titulo,
                        total_recursos: recursos.length
                    });
                }
            }
        }
        const entregas = await this.prisma.lms_entregas.findMany({
            where: {
                tarea_guid: {
                    in: allResourceGuids
                }
            },
            select: {
                usuario_guid: true,
                tarea_guid: true,
                estado: true,
                fecha_entrega: true
            }
        });
        // 3. Get unique student guids
        const studentGuids = [
            ...new Set(entregas.map((e)=>e.usuario_guid))
        ];
        // Also get all students (role ESTUDIANTE)
        const allStudents = await this.prisma.usuarios.findMany({
            where: {
                rol: 'ESTUDIANTE'
            },
            select: {
                guid: true,
                nombre: true,
                apellido: true,
                email: true,
                updated_at: true
            }
        });
        // 4. Build result — for each student, calculate progress per course
        const result = allStudents.map((student)=>{
            const studentEntregas = entregas.filter((e)=>e.usuario_guid === student.guid);
            const completedResources = new Set(studentEntregas.map((e)=>e.tarea_guid));
            const cursosProgress = cursos.map((curso)=>{
                const totalRecursos = curso.modulos.reduce((sum, mod)=>sum + mod.lecciones.reduce((s, l)=>s + l.recursos.length, 0), 0);
                const completados = curso.modulos.reduce((sum, mod)=>{
                    const recursos = mod.lecciones.flatMap((l)=>l.recursos);
                    return sum + recursos.filter((r)=>completedResources.has(r.guid)).length;
                }, 0);
                return {
                    curso_guid: curso.guid,
                    curso_titulo: curso.titulo,
                    total_recursos: totalRecursos,
                    completados,
                    porcentaje: totalRecursos > 0 ? Math.round(completados / totalRecursos * 100) : 0,
                    modulos: curso.modulos.map((mod)=>{
                        const modRecursos = mod.lecciones.flatMap((l)=>l.recursos);
                        const modCompletados = modRecursos.filter((r)=>completedResources.has(r.guid)).length;
                        return {
                            titulo: mod.titulo,
                            total: modRecursos.length,
                            completados: modCompletados,
                            porcentaje: modRecursos.length > 0 ? Math.round(modCompletados / modRecursos.length * 100) : 0
                        };
                    })
                };
            });
            return {
                guid: student.guid,
                nombre: student.nombre,
                apellido: student.apellido,
                email: student.email,
                ultima_actividad: student.updated_at,
                total_entregas: studentEntregas.length,
                cursos: cursosProgress
            };
        });
        return result;
    }
    async getEntregasParaCalificar(profesor_guid) {
        // 1. Get courses assigned to this professor
        const cursos = await this.prisma.lms_cursos.findMany({
            where: {
                profesor_guid
            },
            include: {
                modulos: {
                    include: {
                        lecciones: {
                            include: {
                                recursos: {
                                    where: {
                                        tipo: 'TAREA'
                                    },
                                    select: {
                                        guid: true,
                                        titulo: true,
                                        archivo_max_size_mb: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        const tareaGuids = [];
        const tareaInfo = {};
        for (const curso of cursos){
            for (const mod of curso.modulos){
                for (const lec of mod.lecciones){
                    for (const rec of lec.recursos){
                        tareaGuids.push(rec.guid);
                        tareaInfo[rec.guid] = {
                            titulo: rec.titulo,
                            curso_titulo: curso.titulo
                        };
                    }
                }
            }
        }
        if (tareaGuids.length === 0) return [];
        // 2. Get all entregas for these tareas
        const entregas = await this.prisma.lms_entregas.findMany({
            where: {
                tarea_guid: {
                    in: tareaGuids
                }
            },
            orderBy: {
                fecha_entrega: 'desc'
            }
        });
        // 3. Get student info
        const studentGuids = [
            ...new Set(entregas.map((e)=>e.usuario_guid))
        ];
        const students = await this.prisma.usuarios.findMany({
            where: {
                guid: {
                    in: studentGuids
                }
            },
            select: {
                guid: true,
                nombre: true,
                apellido: true,
                email: true
            }
        });
        const studentMap = Object.fromEntries(students.map((s)=>[
                s.guid,
                s
            ]));
        return entregas.map((e)=>({
                guid: e.guid,
                tarea_guid: e.tarea_guid,
                tarea_titulo: tareaInfo[e.tarea_guid || '']?.titulo || 'Sin título',
                curso_titulo: tareaInfo[e.tarea_guid || '']?.curso_titulo || 'Sin curso',
                estudiante: studentMap[e.usuario_guid] || {
                    nombre: 'Desconocido',
                    apellido: '',
                    email: ''
                },
                archivo_nombre: e.respuesta_texto,
                archivo_servidor: e.url_archivo_adjunto,
                estado: e.estado,
                fecha_entrega: e.fecha_entrega,
                contenido_texto: e.contenido_texto
            }));
    }
    async calificarEntrega(guid, data) {
        return this.prisma.lms_entregas.update({
            where: {
                guid
            },
            data: {
                estado: 'CALIFICADA',
                contenido_texto: `NOTA: ${data.calificacion}${data.comentario ? ` | ${data.comentario}` : ''}`
            }
        });
    }
    constructor(prisma){
        this.prisma = prisma;
        // Ensure uploads directory exists
        if (!_fs.existsSync(UPLOADS_DIR)) {
            _fs.mkdirSync(UPLOADS_DIR, {
                recursive: true
            });
        }
    }
};
CursosService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _prismaservice.PrismaService === "undefined" ? Object : _prismaservice.PrismaService
    ])
], CursosService);

//# sourceMappingURL=cursos.service.js.map