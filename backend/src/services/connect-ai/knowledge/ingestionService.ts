import fs from 'fs/promises';
import path from 'path';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import type { ConnectKnowledgeSourceType } from '@prisma/client';
import { getUploadsDir } from '../../../lib/uploadsDir.js';
import {
  createKnowledgeSource,
  markSourceFailed,
  replaceSourceChunks,
} from '../repositories/knowledgeRepository.js';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 120;

export function chunkText(text: string, title?: string): Array<{ position: number; title?: string; content: string }> {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];

  const chunks: Array<{ position: number; title?: string; content: string }> = [];
  let start = 0;
  let position = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    let slice = normalized.slice(start, end);
    if (end < normalized.length) {
      const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
      if (lastBreak > CHUNK_SIZE * 0.5) slice = slice.slice(0, lastBreak + 1);
    }
    const content = slice.trim();
    if (content.length > 40) {
      chunks.push({ position, title: position === 0 ? title : undefined, content });
      position += 1;
    }
    if (start + slice.length >= normalized.length) break;
    start += Math.max(slice.length - CHUNK_OVERLAP, 1);
  }
  return chunks;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/** SSRF-safe public URL validation. */
export async function assertSafePublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL invalide');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Seuls http/https sont autorisés');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw new Error('URL locale refusée');
  }
  const hostIp = isIP(url.hostname) ? url.hostname : (await lookup(url.hostname)).address;
  if (isPrivateIp(hostIp)) {
    throw new Error('Adresse privée refusée');
  }
  return url;
}

async function fetchWebsiteText(url: string): Promise<string> {
  const safe = await assertSafePublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(safe.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Ciblix-ConnectAI/1.0 (+knowledge-ingest)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = stripHtml(html);
    if (text.length < 80) throw new Error('Page trop vide après extraction');
    return text.slice(0, 200_000);
  } finally {
    clearTimeout(timer);
  }
}

async function extractFileText(filePath: string, mimeType?: string, originalName?: string): Promise<string> {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const buf = await fs.readFile(filePath);

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buf);
    const text = (parsed.text || '').trim();
    if (text.length < 40) throw new Error('PDF sans texte extractible');
    return text.slice(0, 200_000);
  }

  if (['.txt', '.md', '.csv', '.html', '.htm'].includes(ext) || mimeType?.startsWith('text/')) {
    const raw = buf.toString('utf8');
    return (ext === '.html' || ext === '.htm' || mimeType === 'text/html' ? stripHtml(raw) : raw).slice(0, 200_000);
  }

  throw new Error('Format non supporté (PDF, TXT, MD, CSV, HTML)');
}

async function indexSource(params: {
  organizationId: string;
  sourceId: string;
  text: string;
  title?: string;
}) {
  const chunks = chunkText(params.text, params.title);
  if (!chunks.length) throw new Error('Aucun contenu indexable');
  await replaceSourceChunks({
    organizationId: params.organizationId,
    sourceId: params.sourceId,
    extractedText: params.text,
    chunks,
  });
  return chunks.length;
}

export async function ingestTextSource(params: {
  organizationId: string;
  userId: string;
  name: string;
  content: string;
  type?: Extract<ConnectKnowledgeSourceType, 'TEXT' | 'FAQ' | 'PRICING'>;
}) {
  const type = params.type ?? 'TEXT';
  const source = await createKnowledgeSource({
    organizationId: params.organizationId,
    createdById: params.userId,
    name: params.name,
    type,
  });
  try {
    const chunkCount = await indexSource({
      organizationId: params.organizationId,
      sourceId: source.id,
      text: params.content,
      title: params.name,
    });
    return { sourceId: source.id, chunkCount, status: 'READY' as const };
  } catch (err) {
    await markSourceFailed(source.id, err instanceof Error ? err.message : 'Indexation échouée');
    throw err;
  }
}

export async function ingestUrlSource(params: {
  organizationId: string;
  userId: string;
  url: string;
  name?: string;
}) {
  const url = await assertSafePublicUrl(params.url);
  const source = await createKnowledgeSource({
    organizationId: params.organizationId,
    createdById: params.userId,
    name: params.name || url.hostname,
    type: 'WEBSITE',
    sourceUrl: url.toString(),
  });
  try {
    const text = await fetchWebsiteText(url.toString());
    const chunkCount = await indexSource({
      organizationId: params.organizationId,
      sourceId: source.id,
      text,
      title: params.name || url.hostname,
    });
    return { sourceId: source.id, chunkCount, status: 'READY' as const };
  } catch (err) {
    await markSourceFailed(source.id, err instanceof Error ? err.message : 'Indexation échouée');
    throw err;
  }
}

export async function ingestFileSource(params: {
  organizationId: string;
  userId: string;
  filePath: string;
  originalName: string;
  mimeType?: string;
  name?: string;
}) {
  const source = await createKnowledgeSource({
    organizationId: params.organizationId,
    createdById: params.userId,
    name: params.name || params.originalName,
    type: 'FILE',
    storageRef: params.filePath,
    mimeType: params.mimeType,
  });
  try {
    const text = await extractFileText(params.filePath, params.mimeType, params.originalName);
    const chunkCount = await indexSource({
      organizationId: params.organizationId,
      sourceId: source.id,
      text,
      title: params.name || params.originalName,
    });
    return { sourceId: source.id, chunkCount, status: 'READY' as const };
  } catch (err) {
    await markSourceFailed(source.id, err instanceof Error ? err.message : 'Indexation échouée');
    throw err;
  }
}

export async function reindexSource(organizationId: string, sourceId: string) {
  const source = await import('../repositories/knowledgeRepository.js').then((m) =>
    m.getKnowledgeSource(organizationId, sourceId)
  );
  if (!source) throw new Error('Source introuvable');

  try {
    let text = source.extractedText || '';
    if (source.type === 'WEBSITE' && source.sourceUrl) {
      text = await fetchWebsiteText(source.sourceUrl);
    } else if (source.type === 'FILE' && source.storageRef) {
      text = await extractFileText(source.storageRef, source.mimeType || undefined, source.name);
    }
    if (!text.trim()) throw new Error('Aucun texte à réindexer');
    const chunkCount = await indexSource({
      organizationId,
      sourceId,
      text,
      title: source.name,
    });
    return { sourceId, chunkCount, status: 'READY' as const };
  } catch (err) {
    await markSourceFailed(sourceId, err instanceof Error ? err.message : 'Réindexation échouée');
    throw err;
  }
}

export function knowledgeUploadDir(organizationId: string): string {
  const dir = path.join(getUploadsDir(), 'connect-knowledge', organizationId);
  return dir;
}
