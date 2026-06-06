import { prisma } from '../../db/prisma.js';

/** Phase 2 — notifications in-app pour alertes BrandPulse. */
export async function pushBrandPulseNotification(
  organizationId: string,
  title: string,
  content: string,
  link = '/agents/brand-pulse',
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
    take: 20,
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      organizationId,
      userId: u.id,
      type: 'BRAND_PULSE_ALERT' as const,
      title,
      content,
      link,
    })),
  });
}
