import { prisma } from '../../../db/prisma.js';
import type { ConnectMessageStrategy } from '../core/types.js';

export async function listTemplates(organizationId: string) {
  return prisma.connectPromptTemplate.findMany({
    where: { OR: [{ organizationId }, { organizationId: null }], active: true },
    orderBy: [{ organizationId: 'desc' }, { name: 'asc' }],
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
}

export async function createTemplateVersion(params: {
  organizationId?: string;
  slug: string;
  name: string;
  strategy: ConnectMessageStrategy;
  systemPrompt: string;
  userPrompt: string;
  createdById?: string;
}) {
  const orgId = params.organizationId ?? null;

  let template = await prisma.connectPromptTemplate.findFirst({
    where: { organizationId: orgId, slug: params.slug },
  });

  if (!template) {
    template = await prisma.connectPromptTemplate.create({
      data: {
        organizationId: orgId,
        slug: params.slug,
        name: params.name,
        strategy: params.strategy,
      },
    });
  } else {
    template = await prisma.connectPromptTemplate.update({
      where: { id: template.id },
      data: { name: params.name, strategy: params.strategy },
    });
  }

  const lastVersion = await prisma.connectPromptVersion.findFirst({
    where: { templateId: template.id },
    orderBy: { version: 'desc' },
  });

  const version = (lastVersion?.version ?? 0) + 1;

  const promptVersion = await prisma.connectPromptVersion.create({
    data: {
      templateId: template.id,
      version,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      createdById: params.createdById,
    },
  });

  return { template, promptVersion };
}
