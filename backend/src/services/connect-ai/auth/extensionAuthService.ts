import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../db/prisma.js';

const CODE_TTL_MS = 2 * 60 * 1000;

function sha256Base64Url(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function getExtensionConnectUrl(params: {
  codeChallenge: string;
  state: string;
  redirectUri: string;
}): string {
  const q = new URLSearchParams({
    code_challenge: params.codeChallenge,
    state: params.state,
    redirect_uri: params.redirectUri,
  });
  return `${frontendBaseUrl()}/extension/connect?${q.toString()}`;
}

export async function createExtensionAuthCode(params: {
  userId: string;
  organizationId: string;
  codeChallenge: string;
  redirectUri: string;
}): Promise<string> {
  const code = randomBytes(32).toString('base64url');
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.connectExtensionAuthCode.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      codeHash,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      expiresAt,
    },
  });

  return code;
}

async function createSessionTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, token: refreshTokenHash, expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function exchangeExtensionAuthCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; name: string; email: string } }> {
  const challenge = sha256Base64Url(params.codeVerifier);

  const candidates = await prisma.connectExtensionAuthCode.findMany({
    where: {
      redirectUri: params.redirectUri,
      usedAt: null,
      expiresAt: { gt: new Date() },
      codeChallenge: challenge,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: true },
  });

  let match = null;
  for (const row of candidates) {
    if (await bcrypt.compare(params.code, row.codeHash)) {
      match = row;
      break;
    }
  }

  if (!match) {
    throw new Error('Code d\'autorisation invalide ou expiré');
  }

  await prisma.connectExtensionAuthCode.update({
    where: { id: match.id },
    data: { usedAt: new Date() },
  });

  const { accessToken, refreshToken } = await createSessionTokens(match.userId);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
    user: {
      id: match.user.id,
      name: match.user.name,
      email: match.user.email,
    },
  };
}

export async function refreshExtensionAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { userId: string };
  const allTokens = await prisma.refreshToken.findMany({ where: { userId: decoded.userId } });

  let valid = false;
  for (const row of allTokens) {
    if (await bcrypt.compare(refreshToken, row.token)) {
      if (row.expiresAt >= new Date()) valid = true;
      break;
    }
  }
  if (!valid) throw new Error('Session expirée — reconnectez-vous');

  const accessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  return { accessToken, expiresIn: 900 };
}
