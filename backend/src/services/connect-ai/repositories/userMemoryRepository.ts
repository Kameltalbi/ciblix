import { prisma } from '../../../db/prisma.js';
import type { ConnectTone, UserMemory } from '../core/types.js';

const DEFAULT_MEMORY: UserMemory = {
  preferredTone: 'professionnel',
  messageLength: 'court',
  avoidPhrases: [],
  styleNotes: [],
};

const LEARN_PATTERNS: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /plus court|plus concis|raccourci/i, note: 'Préfère les messages courts' },
  { pattern: /plus chaleureux|plus amical|moins froid/i, note: 'Préfère un ton chaleureux' },
  { pattern: /plus professionnel|plus formel/i, note: 'Préfère un ton très professionnel' },
  { pattern: /sans emoji|pas d'emoji/i, note: 'Ne pas utiliser d\'emoji' },
  { pattern: /en anglais|in english/i, note: 'Peut rédiger en anglais' },
  { pattern: /économies|coûts|roi|retour sur investissement/i, note: 'Mettre l\'accent sur les économies et le ROI' },
  { pattern: /j'espère que vous allez bien/i, note: 'Éviter: "J\'espère que vous allez bien."' },
];

const AVOID_PHRASE_PATTERNS = [
  /ne (?:pas |jamais )?utiliser[:\s]+["']?(.+?)["']?$/i,
  /éviter[:\s]+["']?(.+?)["']?$/i,
];

export async function getUserMemory(userId: string): Promise<UserMemory> {
  const row = await prisma.connectUserMemory.findUnique({ where: { userId } });
  if (!row) return { ...DEFAULT_MEMORY };
  return {
    preferredTone: (row.preferredTone as ConnectTone) || 'professionnel',
    messageLength: row.messageLength || 'court',
    avoidPhrases: row.avoidPhrases,
    styleNotes: row.styleNotes,
  };
}

export async function updateUserTone(userId: string, tone: ConnectTone): Promise<void> {
  await prisma.connectUserMemory.upsert({
    where: { userId },
    create: { userId, preferredTone: tone },
    update: { preferredTone: tone },
  });
}

export async function learnFromInstruction(userId: string, instruction: string): Promise<void> {
  const memory = await getUserMemory(userId);
  const styleNotes = new Set(memory.styleNotes);
  const avoidPhrases = new Set(memory.avoidPhrases);

  for (const { pattern, note } of LEARN_PATTERNS) {
    if (pattern.test(instruction)) styleNotes.add(note);
  }

  for (const pattern of AVOID_PHRASE_PATTERNS) {
    const m = instruction.match(pattern);
    if (m?.[1]) avoidPhrases.add(m[1].trim());
  }

  if (/j'espère que vous allez bien/i.test(instruction)) {
    avoidPhrases.add("J'espère que vous allez bien.");
  }

  await prisma.connectUserMemory.upsert({
    where: { userId },
    create: {
      userId,
      styleNotes: [...styleNotes],
      avoidPhrases: [...avoidPhrases],
      lastLearnedAt: new Date(),
    },
    update: {
      styleNotes: [...styleNotes],
      avoidPhrases: [...avoidPhrases],
      lastLearnedAt: new Date(),
    },
  });
}

export function formatUserMemoryForPrompt(memory: UserMemory): string {
  const parts: string[] = [`Ton: ${memory.preferredTone}`, `Longueur: ${memory.messageLength}`];
  if (memory.styleNotes.length) parts.push(`Préférences: ${memory.styleNotes.join('; ')}`);
  if (memory.avoidPhrases.length) parts.push(`Ne jamais utiliser: ${memory.avoidPhrases.join(' | ')}`);
  return parts.join('\n');
}
