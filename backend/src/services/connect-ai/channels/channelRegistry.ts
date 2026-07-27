import type { ConnectChannelSlug } from '../core/types.js';
import type { IChannel } from './IChannel.js';
import { LinkedInChannel } from './linkedin/LinkedInChannel.js';

const channels: IChannel[] = [new LinkedInChannel()];

const bySlug = new Map<ConnectChannelSlug, IChannel>(
  channels.map((c) => [c.slug, c])
);

export function getChannel(slug: ConnectChannelSlug): IChannel | undefined {
  return bySlug.get(slug);
}

export function getAllChannels(): IChannel[] {
  return [...channels];
}

export function resolveChannelFromUrl(url: string): IChannel | undefined {
  try {
    const u = new URL(url);
    const ctx = { url: u.href, hostname: u.hostname, pathname: u.pathname };
    return channels.find((c) => c.detect(ctx));
  } catch {
    return undefined;
  }
}
