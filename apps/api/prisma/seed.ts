import { PrismaClient, lms_rol_usuario } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database with secure credentials...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const examPassword = await bcrypt.hash('exam123', 10);
  const capaPassword = await bcrypt.hash('capa123', 10);

  const adminUser = await prisma.usuarios.upsert({
    where: { email: 'admin@pesv.com' },
    update: { contrasena: adminPassword, rol: lms_rol_usuario.ADMINISTRADOR },
    create: {
      email: 'admin@pesv.com',
      contrasena: adminPassword,
      nombre: 'Administrador',
      apellido: 'Principal',
      rol: lms_rol_usuario.ADMINISTRADOR,
    },
  });

  const teacherUser = await prisma.usuarios.upsert({
    where: { email: 'examinador@pesv.com' },
    update: { contrasena: examPassword, rol: lms_rol_usuario.PROFESOR },
    create: {
      email: 'examinador@pesv.com',
      contrasena: examPassword,
      nombre: 'Supervisor',
      apellido: 'PESV',
      rol: lms_rol_usuario.PROFESOR,
    },
  });

  const studentUser = await prisma.usuarios.upsert({
    where: { email: 'capacitante@pesv.com' },
    update: { contrasena: capaPassword, rol: lms_rol_usuario.ESTUDIANTE },
    create: {
      email: 'capacitante@pesv.com',
      contrasena: capaPassword,
      nombre: 'Personal',
      apellido: 'En Capacitacion',
      rol: lms_rol_usuario.ESTUDIANTE,
    },
  });

  console.log('--- CREDENCIALES GENERADAS EXITOSAMENTE ---');
  console.log(`ADMIN: ${adminUser.email} / admin123`);
  console.log(`SUPERVISOR: ${teacherUser.email} / exam123`);
  console.log(`CAPACITADO: ${studentUser.email} / capa123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
