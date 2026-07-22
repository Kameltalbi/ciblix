import { prisma } from '../../db/prisma.js';

/** Premier OWNER de l'org — utilisé pour les AgentEvent créés par intégrations webhook. */
export async function getIntegrationUserId(organizationId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { organizationId, role: { in: ['OWNER', 'SUPERADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!user) throw new Error('NO_INTEGRATION_USER');
  return user.id;
}
