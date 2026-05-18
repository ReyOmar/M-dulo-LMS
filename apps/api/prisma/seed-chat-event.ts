/**
 * Quick script to insert the MENSAJE_CHAT email event into the database
 * and update RECORDATORIO_INACTIVIDAD variables.
 * Run with: pnpm exec ts-node prisma/seed-chat-event.ts
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

async function main() {
  // 1. Insert MENSAJE_CHAT event
  const chatEvt = await prisma.lms_eventos_correo.findUnique({
    where: { identificador: 'MENSAJE_CHAT' },
  });

  if (!chatEvt) {
    const evt = await prisma.lms_eventos_correo.create({
      data: {
        identificador: 'MENSAJE_CHAT',
        nombre_legible: 'Mensaje de Chat (Offline)',
        descripcion: 'Se envía al usuario cuando recibe un mensaje directo y no está conectado a la plataforma.',
        variables: JSON.stringify(['nombre', 'remitente', 'mensaje_preview', 'origen', 'url_mensajes']),
      },
    });
    await prisma.lms_plantillas_correo.create({
      data: {
        evento_id: evt.id,
        nombre_interno: 'Plantilla por defecto - Mensaje Chat',
        asunto: '💬 Nuevo mensaje de {{remitente}}',
        cuerpo_html: `<h2 style="color:#1e293b;margin:0 0 16px">💬 Tienes un mensaje nuevo</h2>
<p style="color:#64748b;font-size:15px;line-height:1.6">Hola <strong>{{nombre}}</strong>, <strong>{{remitente}}</strong> te ha enviado un mensaje.</p>
<div style="background:#f8fafc;border-left:4px solid #4f46e5;border-radius:8px;padding:16px;margin:20px 0">
  <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">{{origen}}</p>
  <p style="color:#334155;font-size:14px;line-height:1.6;margin:0;font-style:italic">"{{mensaje_preview}}"</p>
</div>
<div style="text-align:center;margin:32px 0">
  <a href="{{url_mensajes}}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:15px">Ver Mensajes</a>
</div>`,
        es_sistema: true,
        activo: true,
      },
    });
    console.log('✅ Created: MENSAJE_CHAT');
  } else {
    console.log('⏭️  Skipped (exists): MENSAJE_CHAT');
  }

  // 2. Update RECORDATORIO_INACTIVIDAD variables to include progreso_cursos
  const inactEvt = await prisma.lms_eventos_correo.findUnique({
    where: { identificador: 'RECORDATORIO_INACTIVIDAD' },
  });
  if (inactEvt) {
    const currentVars = JSON.parse(inactEvt.variables || '[]');
    if (!currentVars.includes('progreso_cursos')) {
      currentVars.splice(currentVars.indexOf('url_campus'), 0, 'progreso_cursos');
      await prisma.lms_eventos_correo.update({
        where: { id: inactEvt.id },
        data: { variables: JSON.stringify(currentVars) },
      });
      console.log('✅ Updated: RECORDATORIO_INACTIVIDAD variables');
    } else {
      console.log('⏭️  Skipped: RECORDATORIO_INACTIVIDAD already has progreso_cursos');
    }
  }

  console.log('Done! Chat event + inactivity update ready.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
