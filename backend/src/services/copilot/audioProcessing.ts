import { readFile } from 'node:fs/promises';
import { putRawContent } from '../agent-memory/s3RawContent.js';

const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/ogg',
]);

export function isAllowedAudioMime(mime: string): boolean {
  return AUDIO_MIME.has(mime) || mime.startsWith('audio/');
}

export async function uploadAudioBuffer(opts: {
  organizationId: string;
  userId: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<string> {
  return putRawContent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    buffer: opts.buffer,
    mimeType: opts.mimeType,
    originalName: opts.originalName,
  });
}

export async function transcribeAudio(filePath: string, mimeType: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const buffer = await readFile(filePath);
  const blob = new Blob([buffer], { type: mimeType || 'audio/mpeg' });
  const form = new FormData();
  form.append('file', blob, 'audio');
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Whisper error: ${await response.text()}`);
  }

  const text = (await response.text()).trim();
  if (!text) throw new Error('Transcription vide');
  return text;
}
