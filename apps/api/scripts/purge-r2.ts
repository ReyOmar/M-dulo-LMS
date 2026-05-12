/**
 * One-time R2 bucket cleanup script.
 * Preserves only files under 'certificados/' prefix.
 * Deletes everything else (logos, firmas, entregas, avatars, portadas, etc.)
 * 
 * Usage: npx ts-node scripts/purge-r2.ts
 */
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from monorepo root — try multiple paths
const envPaths = [
  path.resolve(__dirname, '../../.env'),       // from apps/api/scripts/
  path.resolve(process.cwd(), '.env'),          // from CWD
  path.resolve(process.cwd(), '../../.env'),    // from apps/api CWD
];
for (const p of envPaths) {
  dotenv.config({ path: p, override: true });
  if (process.env.R2_ACCOUNT_ID) break;
}

const PROTECTED_PREFIXES = ['certificados/'];

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'lms-uploads';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ R2 credentials not found in .env. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
    process.exit(1);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log(`🔍 Listing all objects in bucket: ${bucketName}...`);

  let continuationToken: string | undefined;
  let totalListed = 0;
  let totalDeleted = 0;
  let totalProtected = 0;

  do {
    const listCmd = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const res = await s3.send(listCmd);
    const objects = res.Contents || [];
    continuationToken = res.NextContinuationToken;
    totalListed += objects.length;

    // Separate protected vs deletable
    const toDelete: { Key: string }[] = [];
    for (const obj of objects) {
      if (!obj.Key) continue;
      const isProtected = PROTECTED_PREFIXES.some(prefix => obj.Key!.startsWith(prefix)) || obj.Key!.endsWith('.keep');
      if (isProtected) {
        totalProtected++;
        console.log(`  🛡️  PROTECTED: ${obj.Key}`);
      } else {
        toDelete.push({ Key: obj.Key });
        console.log(`  🗑️  TO DELETE: ${obj.Key}`);
      }
    }

    // Batch delete (max 1000 per request)
    if (toDelete.length > 0) {
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: toDelete, Quiet: false },
      });
      const deleteRes = await s3.send(deleteCmd);
      totalDeleted += deleteRes.Deleted?.length || 0;
      
      if (deleteRes.Errors && deleteRes.Errors.length > 0) {
        console.error('⚠️  Delete errors:', deleteRes.Errors);
      }
    }

  } while (continuationToken);

  console.log('\n════════════════════════════════════════');
  console.log(`📊 SUMMARY`);
  console.log(`   Total objects found:     ${totalListed}`);
  console.log(`   Protected (certificados): ${totalProtected}`);
  console.log(`   Deleted:                 ${totalDeleted}`);
  console.log('════════════════════════════════════════');
  console.log('✅ R2 cleanup complete!');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
