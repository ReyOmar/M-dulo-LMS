/**
 * Quick script to insert the 5 new email events into the database.
 * Run with: npx ts-node prisma/seed-new-events.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function parseDbUrl(url: string) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error(`Invalid DATABASE_URL: ${url}`);
  return { user: match[1], password: match[2], host: match[3], port: parseInt(match[4], 10), database: match[5] };
}
const dbConfig = parseDbUrl(process.env.DATABASE_URL || 'mysql://lms_user:lms_password@localhost:3307/lms_db');
const adapter = new PrismaMariaDb({ ...dbConfig, connectionLimit: 5 });
const prisma = new PrismaClient({ adapter });

const newEvents = [
  {
    identificador: 'CURSO_MANTENIMIENTO',
    nombre_legible: 'Curso en Mantenimiento',
    descripcion: 'Se envía a los estudiantes matriculados cuando un curso pasa a estado Borrador (mantenimiento).',
    variables: JSON.stringify(["nombre", "cursoTitulo", "url_campus"]),
    plantilla: {
      nombre_interno: 'Plantilla por defecto - Mantenimiento',
      asunto: '🔧 Curso en Mantenimiento: {{cursoTitulo}}',
      cuerpo_html: `<h2 style="color:#1e293b;margin:0 0 16px">🔧 Curso en Mantenimiento</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6">Hola <strong>{{nombre}}</strong>, el curso <strong>"{{cursoTitulo}}"</strong> ha sido puesto temporalmente en mantenimiento.</p>
<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:16px;margin:20px 0">
  <p style="color:#92400e;font-size:14px;font-weight:600;margin:0">⚠️ Tu progreso se mantiene intacto.</p>
</div>
<div style="text-align:center;margin:32px 0">
  <a href="{{url_campus}}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">Ir al Campus</a>
</div>`,
      es_sistema: true,
    }
  },
  {
    identificador: 'MATRICULA_NUEVA',
    nombre_legible: 'Matrícula en Curso',
    descripcion: 'Se envía al estudiante cuando es matriculado en un nuevo curso.',
    variables: JSON.stringify(["nombre", "cursoTitulo", "url_curso"]),
    plantilla: {
      nombre_interno: 'Plantilla por defecto - Matrícula',
      asunto: '📚 Has sido matriculado en: {{cursoTitulo}}',
      cuerpo_html: `<h2 style="color:#1e293b;margin:0 0 16px">📚 ¡Nuevo Curso Disponible!</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6">Hola <strong>{{nombre}}</strong>, has sido matriculado en:</p>
<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
  <p style="font-size:18px;font-weight:800;color:#166534;margin:0">{{cursoTitulo}}</p>
</div>
<div style="text-align:center;margin:32px 0">
  <a href="{{url_curso}}" style="display:inline-block;background:#10b981;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">Comenzar Curso</a>
</div>`,
      es_sistema: true,
    }
  },
  {
    identificador: 'CERTIFICADO_GENERADO',
    nombre_legible: 'Certificado Generado',
    descripcion: 'Se envía al estudiante cuando se genera su certificado de finalización de curso.',
    variables: JSON.stringify(["nombre", "cursoTitulo", "codigo", "url_certificado"]),
    plantilla: {
      nombre_interno: 'Plantilla por defecto - Certificado',
      asunto: '🏆 ¡Certificado Disponible! — {{cursoTitulo}}',
      cuerpo_html: `<h2 style="color:#1e293b;margin:0 0 16px">🏆 ¡Felicitaciones, {{nombre}}!</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6">Tu certificado de <strong>"{{cursoTitulo}}"</strong> ya está disponible.</p>
<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
  <p style="color:#94a3b8;font-size:12px;margin:0 0 8px">Código de verificación</p>
  <p style="font-size:18px;font-weight:800;letter-spacing:2px;color:#1e293b;font-family:monospace;margin:0">{{codigo}}</p>
</div>
<div style="text-align:center;margin:32px 0">
  <a href="{{url_certificado}}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">Ver Certificado</a>
</div>`,
      es_sistema: true,
    }
  },
  {
    identificador: 'ENTREGA_RECHAZADA',
    nombre_legible: 'Entrega Rechazada',
    descripcion: 'Se envía al estudiante cuando su entrega recibe una calificación por debajo de la nota mínima aprobatoria.',
    variables: JSON.stringify(["nombre", "tarea", "calificacion", "comentario", "url_campus"]),
    plantilla: {
      nombre_interno: 'Plantilla por defecto - Entrega Rechazada',
      asunto: '⚠️ Entrega requiere mejora: {{tarea}}',
      cuerpo_html: `<h2 style="color:#1e293b;margin:0 0 16px">⚠️ Entrega No Aprobada</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6">Hola <strong>{{nombre}}</strong>, tu entrega en <strong>"{{tarea}}"</strong> no alcanzó la nota mínima.</p>
<div style="text-align:center;margin:24px 0;padding:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px">
  <span style="font-size:36px;font-weight:800;color:#ef4444">{{calificacion}}</span>
  <span style="font-size:18px;color:#94a3b8">/5.0</span>
</div>
{{comentario}}
<div style="text-align:center;margin:32px 0">
  <a href="{{url_campus}}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">Ir al Campus</a>
</div>`,
      es_sistema: true,
    }
  },
  {
    identificador: 'CURSO_COMPLETADO',
    nombre_legible: 'Curso Completado (Examinador)',
    descripcion: 'Se envía al examinador asignado cuando un estudiante completa todos los requisitos de un curso.',
    variables: JSON.stringify(["examinerNombre", "estudiante", "cursoTitulo", "url_monitoreo"]),
    plantilla: {
      nombre_interno: 'Plantilla por defecto - Curso Completado',
      asunto: '✅ {{estudiante}} completó: {{cursoTitulo}}',
      cuerpo_html: `<h2 style="color:#1e293b;margin:0 0 16px">✅ Estudiante Completó el Curso</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6">Hola <strong>{{examinerNombre}}</strong>, <strong>{{estudiante}}</strong> completó el curso:</p>
<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
  <p style="font-size:18px;font-weight:800;color:#166534;margin:0">{{cursoTitulo}}</p>
</div>
<div style="text-align:center;margin:32px 0">
  <a href="{{url_monitoreo}}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none">Ver Monitoreo</a>
</div>`,
      es_sistema: true,
    }
  }
];

async function main() {
  console.log('Inserting 5 new email events...');
  
  for (const eb of newEvents) {
    let evt = await prisma.lms_eventos_correo.findUnique({
      where: { identificador: eb.identificador }
    });
    if (!evt) {
      evt = await prisma.lms_eventos_correo.create({
        data: {
          identificador: eb.identificador,
          nombre_legible: eb.nombre_legible,
          descripcion: eb.descripcion,
          variables: eb.variables
        }
      });
      await prisma.lms_plantillas_correo.create({
        data: {
          evento_id: evt.id,
          nombre_interno: eb.plantilla.nombre_interno,
          asunto: eb.plantilla.asunto,
          cuerpo_html: eb.plantilla.cuerpo_html,
          es_sistema: eb.plantilla.es_sistema,
          activo: true
        }
      });
      console.log(`✅ Created: ${eb.identificador}`);
    } else {
      console.log(`⏭️  Skipped (exists): ${eb.identificador}`);
    }
  }
  
  console.log('Done! All 5 new email events are ready.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
