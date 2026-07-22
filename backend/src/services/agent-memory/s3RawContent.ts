import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { getUploadsDir } from '../../lib/uploadsDir.js';

export type PutRawContentInput = {
  organizationId: string;
  userId: string;
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
};

function extensionForMime(mimeType: string, originalName?: string): string {
  if (originalName) {
    const ext = path.extname(originalName);
    if (ext) return ext;
  }
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('text')) return '.txt';
  return '.bin';
}

/**
 * Stockage objet pour transcriptions brutes (S3 ou stub local).
 */
export async function putRawContent(input: PutRawContentInput): Promise<string> {
  const bucket = process.env.AGENT_EVENT_S3_BUCKET;
  const key = `${input.organizationId}/${Date.now()}-${randomBytes(6).toString('hex')}${extensionForMime(input.mimeType, input.originalName)}`;

  if (bucket) {
    // V2 : brancher AWS SDK @aws-sdk/client-s3 PutObject
    console.info('[agent-memory/s3] put (stub):', bucket, key);
    return `s3://${bucket}/${key}`;
  }

  const dir = path.join(getUploadsDir(), 'agent-events', input.organizationId);
  await fs.mkdir(dir, { recursive: true });
  const filename = path.basename(key);
  await fs.writeFile(path.join(dir, filename), input.buffer);
  return `local:agent-events/${input.organizationId}/${filename}`;
}

export async function deleteRawContent(ref: string): Promise<void> {
  const bucket = process.env.AGENT_EVENT_S3_BUCKET;
  if (ref.startsWith('local:')) {
    const rel = ref.slice('local:'.length);
    const fullPath = path.join(getUploadsDir(), rel);
    try {
      await fs.unlink(fullPath);
    } catch {
      // fichier déjà absent
    }
    return;
  }

  if (!bucket) {
    console.info('[agent-memory/s3] delete skipped (no bucket):', ref);
    return;
  }
  console.info('[agent-memory/s3] delete (stub):', bucket, ref);
}

export function resolveLocalRawPath(ref: string): string | null {
  if (!ref.startsWith('local:')) return null;
  return path.join(getUploadsDir(), ref.slice('local:'.length));
}
