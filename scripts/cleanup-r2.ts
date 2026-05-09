/**
 * R2 Cleanup Script
 * Lists all objects in the R2 bucket, checks which ones are referenced
 * in the database, and deletes orphaned files.
 * 
 * Run from apps/api directory:
 *   npx tsx ../../scripts/cleanup-r2.ts
 */
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'lms-uploads';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ R2 credentials not configured in .env');
    process.exit(1);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  // Parse DATABASE_URL for mysql2
  const dbUrl = process.env.DATABASE_URL || '';
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    console.error('❌ Cannot parse DATABASE_URL:', dbUrl);
    process.exit(1);
  }
  const conn = await mysql.createConnection({
    host: match[3], port: parseInt(match[4]), user: match[1], password: match[2], database: match[5],
  });

  try {
    // 1. List ALL objects in R2
    console.log('📦 Listing all objects in R2 bucket...');
    const allKeys: { key: string; size: number }[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await s3.send(new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) allKeys.push({ key: obj.Key, size: obj.Size || 0 });
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`   Found ${allKeys.length} objects in R2\n`);

    for (const obj of allKeys) {
      console.log(`   - ${obj.key} (${(obj.size / 1024).toFixed(1)} KB)`);
    }
    console.log('');

    if (allKeys.length === 0) {
      console.log('✅ Bucket is empty, nothing to clean.');
      return;
    }

    // 2. Gather ALL file references from the database using raw SQL
    console.log('🔍 Querying database for referenced files...');
    const referencedKeys = new Set<string>();

    // Config: logo, favicon, login background
    const [configRows] = await conn.execute('SELECT logo_url, favicon_url, login_fondo_url FROM lms_configuracion WHERE id = 1') as any;
    if (configRows[0]) {
      for (const field of ['logo_url', 'favicon_url', 'login_fondo_url']) {
        if (configRows[0][field]) referencedKeys.add(configRows[0][field]);
      }
    }

    // User signatures
    const [firmaRows] = await conn.execute('SELECT firma_url FROM usuarios WHERE firma_url IS NOT NULL') as any;
    for (const row of firmaRows) {
      if (row.firma_url) referencedKeys.add(row.firma_url);
    }

    // Course cover images
    const [cursoRows] = await conn.execute('SELECT imagen_portada FROM lms_cursos WHERE imagen_portada IS NOT NULL') as any;
    for (const row of cursoRows) {
      if (row.imagen_portada) referencedKeys.add(row.imagen_portada);
    }

    // Resource attachments (in lms_recursos)
    const [recursoRows] = await conn.execute('SELECT archivo_adjunto FROM lms_recursos WHERE archivo_adjunto IS NOT NULL') as any;
    for (const row of recursoRows) {
      if (row.archivo_adjunto) referencedKeys.add(row.archivo_adjunto);
    }

    // Student submissions
    const [entregaRows] = await conn.execute('SELECT url_archivo_adjunto FROM lms_entregas WHERE url_archivo_adjunto IS NOT NULL') as any;
    for (const row of entregaRows) {
      if (row.url_archivo_adjunto) referencedKeys.add(row.url_archivo_adjunto);
    }

    console.log(`   Found ${referencedKeys.size} referenced files in DB:`);
    for (const key of referencedKeys) {
      console.log(`   ✓ ${key}`);
    }
    console.log('');

    // 3. Find orphans (exclude .keep files — they are folder markers)
    const orphans = allKeys.filter(obj => !referencedKeys.has(obj.key) && !obj.key.endsWith('.keep'));
    const kept = allKeys.filter(obj => referencedKeys.has(obj.key) || obj.key.endsWith('.keep'));
    const orphanSize = orphans.reduce((sum, o) => sum + o.size, 0);

    console.log(`📊 Summary:`);
    console.log(`   Total in R2:       ${allKeys.length}`);
    console.log(`   Referenced (keep):  ${kept.length}`);
    console.log(`   Orphaned (delete):  ${orphans.length} (${(orphanSize / 1024).toFixed(1)} KB)`);
    console.log('');

    if (orphans.length === 0) {
      console.log('✅ No orphaned files found. Bucket is clean!');
      return;
    }

    // 4. Delete orphans
    console.log('🗑️  Deleting orphaned files...');
    let deleted = 0;
    for (const obj of orphans) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: obj.key }));
        console.log(`   ✓ Deleted: ${obj.key} (${(obj.size / 1024).toFixed(1)} KB)`);
        deleted++;
      } catch (err: any) {
        console.error(`   ✗ Failed to delete ${obj.key}: ${err.message}`);
      }
    }

    console.log(`\n✅ Cleanup complete: ${deleted}/${orphans.length} orphaned files deleted. Freed ${(orphanSize / 1024).toFixed(1)} KB`);

  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
