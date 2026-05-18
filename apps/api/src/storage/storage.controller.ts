import {
  Controller,
  Post,
  Get,
  Res,
  Query,
  StreamableFile,
  BadRequestException,
  Req,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyRequest, FastifyReply } from 'fastify';
import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import * as path from 'path';
import * as fs from 'fs';

/**
 * F1.1/F1.2: Storage access model:
 *
 * PUBLIC folders (no auth required):
 *   - portadas: course cover images (shown on landing/catalog)
 *   - logos: platform branding (shown on public pages)
 *   - avatars: profile photos (shown in UI alongside names)
 *
 * PRIVATE folders (auth + ownership required):
 *   - entregas: student submissions (only owner, course professor, or admin)
 *   - firmas: instructor signatures (only owner or admin)
 *   - certificados: certificate PDFs (only owner, course professor, or admin)
 *   - recursos: course resources (only enrolled students, course professor, or admin)
 *
 * Legacy flat files (no folder prefix): treated as public for backward compatibility.
 */
const PUBLIC_FOLDERS = ['portadas', 'logos', 'avatars'];
const PRIVATE_FOLDERS = ['entregas', 'firmas', 'certificados', 'recursos'];
const ALL_FOLDERS = [...PUBLIC_FOLDERS, ...PRIVATE_FOLDERS];

@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Upload a file via multipart/form-data.
   * Accepts a single file field named 'file'.
   */
  @Roles('ADMINISTRADOR', 'PROFESOR')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('/upload')
  async uploadFile(@Req() req: FastifyRequest, @Query('folder') folder?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @fastify/multipart extends request dynamically
    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestException('No se envió ningún archivo. Usa multipart/form-data con el campo "file".');
    }

    // Validate folder param (whitelist to prevent path traversal)
    const ALLOWED_FOLDERS = ['portadas', 'recursos', 'entregas', 'firmas', 'logos'];
    const safeFolder = folder && ALLOWED_FOLDERS.includes(folder) ? folder : undefined;

    // Read the file into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }

    const filename = await this.storageService.uploadFromBuffer(buffer, data.filename || 'file.bin', safeFolder);
    return { filename };
  }

  /**
   * Download/serve a public file. No auth required.
   * Only serves files from PUBLIC_FOLDERS or legacy flat files.
   *
   * Security model:
   * - Public folders (portadas, logos, avatars): accessible without auth
   * - Filenames are UUID-based (unguessable)
   * - Path traversal: prevented by folder whitelist + basename sanitization
   */
  @Public()
  @Get('/download/public/*')
  async downloadPublicFile(
    @Req() req: FastifyRequest,
    @Query('originalName') originalName: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const rawKey: string = (req.params as Record<string, string>)['*'] || '';
    if (!rawKey) throw new BadRequestException('Nombre de archivo requerido.');

    const segments = rawKey.split('/');
    let sanitizedKey: string;

    if (segments.length === 1) {
      // Legacy flat file
      sanitizedKey = path.basename(segments[0]);
    } else if (segments.length === 2 && PUBLIC_FOLDERS.includes(segments[0])) {
      sanitizedKey = `${segments[0]}/${path.basename(segments[1])}`;
    } else {
      throw new ForbiddenException('Acceso denegado a esta ruta de archivo.');
    }

    return this.serveFile(sanitizedKey, originalName, res, false);
  }

  /**
   * F1.1/F1.2: Download a private file with ownership validation.
   *
   * Private folders require:
   *   - entregas: user owns the submission, is course professor, or admin
   *   - firmas: user owns the signature or is admin
   *   - certificados: user owns the certificate, is course professor, or admin
   *   - recursos: user is enrolled in the course, is course professor, or admin
   *
   * Public folders and legacy flat files are served without ownership checks.
   *
   * Three download strategies:
   * 1. R2 with public URL → 302 redirect to CDN
   * 2. R2 without public URL → proxy stream from R2 through API
   * 3. Local file → serve from filesystem
   */
  @Get('/download/*')
  async downloadFile(
    @Req() req: FastifyRequest,
    @Query('originalName') originalName: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const rawKey: string = (req.params as Record<string, string>)['*'] || '';
    if (!rawKey) throw new BadRequestException('Nombre de archivo requerido.');

    // Validate each path segment to prevent directory traversal
    const segments = rawKey.split('/');

    let sanitizedKey: string;
    if (segments.length === 1) {
      // Legacy flat file: "123-abc.pdf"
      sanitizedKey = path.basename(segments[0]);
    } else if (segments.length === 2 && ALL_FOLDERS.includes(segments[0])) {
      // Folder-prefixed: "portadas/123-abc.png"
      sanitizedKey = `${segments[0]}/${path.basename(segments[1])}`;
    } else {
      throw new BadRequestException('Ruta de archivo inválida.');
    }

    // F1.1/F1.2: Ownership validation for private folders
    const folder = segments.length === 2 ? segments[0] : null;
    const isPrivate = !!(folder && PRIVATE_FOLDERS.includes(folder));
    if (isPrivate) {
      await this.assertPrivateFileAccess(user, sanitizedKey, folder!);
    }

    return this.serveFile(sanitizedKey, originalName, res, isPrivate);
  }

  /**
   * F1.2: Verify the requesting user has permission to access a private file.
   * Resolves ownership by looking up the storage key in the relevant domain table.
   *
   * Admins bypass all checks. For each private folder:
   *   - entregas: matches url_archivo_adjunto → owner or course professor
   *   - firmas: matches firma_url on usuarios → owner only
   *   - certificados: matches archivo_pdf on lms_certificados → owner or course professor
   *   - recursos: matches url_archivo/archivo_adjunto on lms_recursos → enrolled or course professor
   */
  private async assertPrivateFileAccess(user: JwtPayload, key: string, folder: string): Promise<void> {
    // Admins can access all private files
    if (user.role === 'ADMINISTRADOR') return;

    const userGuid = user.sub;

    if (folder === 'entregas') {
      // Find the submission that references this file
      const entrega = await this.prisma.lms_entregas.findFirst({
        where: { url_archivo_adjunto: key },
        select: {
          usuario_guid: true,
          tarea: {
            select: {
              leccion: { select: { modulo: { select: { curso: { select: { profesor_guid: true } } } } } },
            },
          },
        },
      });
      if (!entrega) throw new ForbiddenException('Archivo no encontrado o acceso denegado.');
      const isOwner = entrega.usuario_guid === userGuid;
      const isCourseProfessor = entrega.tarea?.leccion?.modulo?.curso?.profesor_guid === userGuid;
      if (!isOwner && !isCourseProfessor) {
        throw new ForbiddenException('No tienes permisos para acceder a este archivo.');
      }
      return;
    }

    if (folder === 'firmas') {
      // Signatures: only the owner can access their own signature
      const owner = await this.prisma.usuarios.findFirst({
        where: { firma_url: key },
        select: { guid: true },
      });
      if (!owner || owner.guid !== userGuid) {
        throw new ForbiddenException('No tienes permisos para acceder a esta firma.');
      }
      return;
    }

    if (folder === 'certificados') {
      // Certificates: owner or course professor
      const cert = await this.prisma.lms_certificados.findFirst({
        where: { archivo_pdf: key },
        select: {
          usuario_guid: true,
          curso: { select: { profesor_guid: true } },
        },
      });
      if (!cert) throw new ForbiddenException('Archivo no encontrado o acceso denegado.');
      const isOwner = cert.usuario_guid === userGuid;
      const isCourseProfessor = cert.curso?.profesor_guid === userGuid;
      if (!isOwner && !isCourseProfessor) {
        throw new ForbiddenException('No tienes permisos para acceder a este certificado.');
      }
      return;
    }

    if (folder === 'recursos') {
      // Course resources: enrolled student or course professor
      const recurso = await this.prisma.lms_recursos.findFirst({
        where: {
          OR: [{ url_archivo: key }, { archivo_adjunto: key }],
        },
        select: {
          leccion: {
            select: {
              modulo: {
                select: {
                  curso_guid: true,
                  curso: { select: { profesor_guid: true } },
                },
              },
            },
          },
        },
      });
      if (!recurso) throw new ForbiddenException('Archivo no encontrado o acceso denegado.');
      const cursoGuid = recurso.leccion?.modulo?.curso_guid;
      const isCourseProfessor = recurso.leccion?.modulo?.curso?.profesor_guid === userGuid;
      if (isCourseProfessor) return;

      // Check enrollment
      if (cursoGuid) {
        const matricula = await this.prisma.lms_matriculas.findUnique({
          where: { usuario_guid_curso_guid: { usuario_guid: userGuid, curso_guid: cursoGuid } },
        });
        if (matricula) return;
      }
      throw new ForbiddenException('No tienes permisos para acceder a este recurso.');
    }

    // Unknown private folder — deny by default
    throw new ForbiddenException('Acceso denegado.');
  }

  /**
   * Internal: serve a file using the 3-strategy approach.
   * @param isPrivate - If true, applies restrictive cache headers and blocks CDN redirect
   */
  private async serveFile(
    sanitizedKey: string,
    originalName: string | undefined,
    res: FastifyReply,
    isPrivate: boolean,
  ) {
    const justFilename = path.basename(sanitizedKey);
    const downloadName = originalName ? path.basename(originalName).replace(/"/g, '') : justFilename;

    // F5.2/F5.3: Determine disposition based on file extension
    // SVG and executable types MUST be served as attachment to prevent XSS
    const fileExt = path.extname(justFilename).toLowerCase();
    const FORCE_DOWNLOAD_EXTS = ['.svg', '.html', '.htm', '.xml'];
    const disposition = FORCE_DOWNLOAD_EXTS.includes(fileExt) ? 'attachment' : 'inline';

    // SEC: Cache headers — private files must never be cached publicly
    const cacheControl = isPrivate ? 'private, no-store, must-revalidate' : 'public, max-age=86400';

    // Strategy 1: R2 with public CDN URL → redirect (PUBLIC files ONLY)
    // SEC: Private files must NEVER redirect to unauthenticated CDN URL
    if (!isPrivate && this.storageService.hasPublicUrl() && !this.storageService.existsLocally(sanitizedKey)) {
      const publicUrl = this.storageService.getFileUrl(sanitizedKey);
      res.status(302).redirect(publicUrl);
      return;
    }

    // Strategy 2: R2 without public URL (or private file) → proxy stream from R2
    if (this.storageService.isCloudStorageActive() && !this.storageService.existsLocally(sanitizedKey)) {
      const r2File = await this.storageService.streamFromR2(sanitizedKey);
      if (r2File) {
        res.header('Content-Type', r2File.contentType);
        res.header('Content-Disposition', `${disposition}; filename="${downloadName}"`);
        res.header('Cache-Control', cacheControl);
        res.header('X-Content-Type-Options', 'nosniff');
        return new StreamableFile(Buffer.from(r2File.buffer));
      }
    }

    // Strategy 3: Serve from local filesystem (checks organized path, then flat legacy)
    const filePath = this.storageService.getUploadPath(sanitizedKey);
    const stream = fs.createReadStream(filePath);

    const ext = justFilename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) contentType = `image/${ext}`;
    else if (ext === 'svg') contentType = 'image/svg+xml';

    res.header('Content-Type', contentType);
    res.header('Content-Disposition', `${disposition}; filename="${downloadName}"`);
    res.header('Cache-Control', cacheControl);
    res.header('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream);
  }
}
