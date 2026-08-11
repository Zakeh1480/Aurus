import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

import { extensionForMimeType } from './avatar-validation';

interface AvatarStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

function getAvatarStorageConfig(): AvatarStorageConfig {
  const endpoint = process.env['AVATAR_STORAGE_ENDPOINT'];
  const bucket = process.env['AVATAR_STORAGE_BUCKET'];
  const accessKeyId = process.env['AVATAR_STORAGE_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['AVATAR_STORAGE_SECRET_ACCESS_KEY'];
  const publicBaseUrl = process.env['AVATAR_STORAGE_PUBLIC_BASE_URL'];

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new Error('Upload de avatar não configurado — variáveis AVATAR_STORAGE_* ausentes.');
  }

  return {
    endpoint,
    region: process.env['AVATAR_STORAGE_REGION'] ?? 'auto',
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

@Injectable()
export class AvatarStorageService {
  async upload(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
    const config = getAvatarStorageConfig();
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });

    const key = `avatars/${userId}/${Date.now()}.${extensionForMimeType(mimeType)}`;
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return `${config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}
