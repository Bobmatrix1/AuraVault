import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const getEnv = (key: string) => import.meta.env[key] || '';

export const r2Config = {
  get accountId() { return localStorage.getItem('r2_account_id') || getEnv('VITE_R2_ACCOUNT_ID'); },
  get bucketName() { return localStorage.getItem('r2_bucket_name') || getEnv('VITE_R2_BUCKET_NAME'); },
  get accessKeyId() { return localStorage.getItem('r2_access_key_id') || getEnv('VITE_R2_ACCESS_KEY_ID'); },
  get secretAccessKey() { return localStorage.getItem('r2_secret_access_key') || getEnv('VITE_R2_SECRET_ACCESS_KEY'); },
};

export function isR2Configured(): boolean {
  return !!(
    r2Config.accountId.trim() &&
    r2Config.bucketName.trim() &&
    r2Config.accessKeyId.trim() &&
    r2Config.secretAccessKey.trim()
  );
}

// Lazy initialization of S3 Client to prevent loading with empty credentials on startup
let s3ClientInstance: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint: `https://${r2Config.accountId.trim()}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: {
        accessKeyId: r2Config.accessKeyId.trim(),
        secretAccessKey: r2Config.secretAccessKey.trim(),
      },
    });
  }
  return s3ClientInstance;
}

// Reset instance when keys change
export function resetS3Client() {
  s3ClientInstance = null;
}

export const r2 = {
  // Fetch bucket details: total used space (sum of object sizes) and limit (10 GB free tier)
  async fetchBucketDetails(): Promise<{ email: string; limit: number; usage: number }> {
    if (!isR2Configured()) {
      throw new Error('Cloudflare R2 configuration is missing');
    }

    try {
      const client = getS3Client();
      const command = new ListObjectsV2Command({
        Bucket: r2Config.bucketName,
      });

      const response = await client.send(command);
      const objects = response.Contents || [];
      const totalUsageBytes = objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);

      // Cloudflare R2's Free Tier is 10 GB (10 * 1024 * 1024 * 1024 bytes)
      const freeTierLimit = 10 * 1024 * 1024 * 1024; 

      return {
        email: 'Cloudflare R2 Bucket',
        limit: freeTierLimit,
        usage: totalUsageBytes,
      };
    } catch (err: any) {
      console.error('Failed to fetch R2 bucket details:', err);
      throw err;
    }
  },

  // Upload file directly to Cloudflare R2 using pre-signed URL + XHR for progress tracking
  async uploadFile(
    file: { name: string; type: string; blob: Blob },
    onProgress?: (percent: number) => void
  ): Promise<string> {
    if (!isR2Configured()) {
      throw new Error('Cloudflare R2 configuration is missing');
    }

    const fileKey = `files/${Date.now()}_${file.name}`;
    const client = getS3Client();

    // 1. Generate pre-signed PUT upload URL client-side
    const command = new PutObjectCommand({
      Bucket: r2Config.bucketName,
      Key: fileKey,
      ContentType: file.type,
    });

    // Signed URL expires in 15 minutes
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    // 2. Perform upload using XHR for accurate progress reporting
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(fileKey);
        } else {
          reject(new Error(`Failed to upload to Cloudflare R2. Status: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error uploading to Cloudflare R2'));
      };

      xhr.send(file.blob);
    });
  },

  // Download file from Cloudflare R2 using pre-signed GET URL + fetch
  async downloadFile(
    fileKey: string,
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    if (!isR2Configured()) {
      throw new Error('Cloudflare R2 configuration is missing');
    }

    const client = getS3Client();

    // 1. Generate pre-signed GET URL
    const command = new GetObjectCommand({
      Bucket: r2Config.bucketName,
      Key: fileKey,
    });

    const downloadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    // 2. Fetch using XHR if progress is needed, or standard fetch
    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', downloadUrl, true);
        xhr.responseType = 'blob';

        xhr.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Failed to download from R2. Status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error downloading from R2'));
        xhr.send();
      });
    } else {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Failed to download file from Cloudflare R2');
      return res.blob();
    }
  },

  // Delete file from Cloudflare R2
  async deleteFile(fileKey: string): Promise<void> {
    if (!isR2Configured()) {
      throw new Error('Cloudflare R2 configuration is missing');
    }

    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: r2Config.bucketName,
      Key: fileKey,
    });

    await client.send(command);
  },

  // List files inside R2 bucket (e.g. for database backups)
  async listFiles(): Promise<{ id: string; name: string }[]> {
    if (!isR2Configured()) {
      return [];
    }

    try {
      const client = getS3Client();
      const command = new ListObjectsV2Command({
        Bucket: r2Config.bucketName,
      });

      const response = await client.send(command);
      const objects = response.Contents || [];
      return objects.map(o => ({
        id: o.Key || '',
        name: o.Key || ''
      }));
    } catch (err) {
      console.error('Failed to list objects in Cloudflare R2:', err);
      return [];
    }
  }
};
