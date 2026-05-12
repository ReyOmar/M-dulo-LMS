import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];
for (const p of envPaths) {
  dotenv.config({ path: p, override: true });
  if (process.env.R2_ACCOUNT_ID) break;
}

async function main() {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const bucket = process.env.R2_BUCKET_NAME || 'lms-uploads';
  const folders = ['entregas/', 'firmas/', 'logos/', 'portadas/', 'recursos/', 'avatars/'];

  for (const f of folders) {
    const key = f + '.keep';
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: '' }));
    console.log(`✅ Restored: ${key}`);
  }
  console.log('\n🎉 All R2 folder placeholders restored!');
}

main().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
