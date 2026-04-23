import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clean() {
    console.log("Eliminando todos los cursos...");
    await prisma.lms_cursos.deleteMany({});
    console.log("Cursos eliminados exitosamente.");
}

clean().catch(console.error).finally(() => prisma.$disconnect());
