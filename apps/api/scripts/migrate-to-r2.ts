/**
 * F7.6: Migration Script — Local Files → Cloudflare R2
 * 
 * Uploads all local files in the `uploads/` directory to R2.
 * Skips files that already exist in R2 (idempotent).
 * 
 * Usage:
 *   npx ts-node scripts/migrate-to-r2.ts
 * 
 * Required env vars (from .env):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env vars from root .env (monorepo root: apps/api/scripts → ../../..)
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CERTS_DIR = path.join(UPLOADS_DIR, 'certificados');

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
};

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'lms-uploads';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env');
    process.exit(1);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log(`\n☁️  Migrating local files to R2 bucket: ${bucketName}`);
  console.log(`📁 Source: ${UPLOADS_DIR}\n`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  // 1. Migrate general uploads (flat files in uploads/)
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => {
      const fullPath = path.join(UPLOADS_DIR, f);
      return fs.statSync(fullPath).isFile();
    });

    console.log(`📂 General uploads: ${files.length} files`);
    for (const file of files) {
      const result = await uploadFile(s3, bucketName, path.join(UPLOADS_DIR, file), file);
      if (result === 'uploaded') uploaded++;
      else if (result === 'skipped') skipped++;
      else errors++;
    }
  }

  // 2. Migrate certificate PDFs (in uploads/certificados/)
  if (fs.existsSync(CERTS_DIR)) {
    const certFiles = fs.readdirSync(CERTS_DIR).filter(f => {
      const fullPath = path.join(CERTS_DIR, f);
      return fs.statSync(fullPath).isFile();
    });

    console.log(`📂 Certificate PDFs: ${certFiles.length} files`);
    for (const file of certFiles) {
      const result = await uploadFile(s3, bucketName, path.join(CERTS_DIR, file), `certificados/${file}`);
      if (result === 'uploaded') uploaded++;
      else if (result === 'skipped') skipped++;
      else errors++;
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Uploaded: ${uploaded}`);
  console.log(`   Skipped (already exists): ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

async function uploadFile(
  s3: S3Client,
  bucket: string,
  localPath: string,
  r2Key: string
): Promise<'uploaded' | 'skipped' | 'error'> {
  try {
    // Check if file already exists in R2
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
      console.log(`  ⏭️  ${r2Key} (already exists)`);
      return 'skipped';
    } catch {
      // File doesn't exist in R2 — proceed with upload
    }

    const buffer = fs.readFileSync(localPath);
    const ext = path.extname(r2Key).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
    }));

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
    console.log(`  ☁️  ${r2Key} (${sizeMB}MB)`);
    return 'uploaded';
  } catch (err: any) {
    console.error(`  ❌ ${r2Key}: ${err.message}`);
    return 'error';
  }
}

main().catch(console.error);
