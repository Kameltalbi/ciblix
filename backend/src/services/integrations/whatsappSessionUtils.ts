export type BufferedMessage = {
  direction: 'IN' | 'OUT';
  text: string;
  at: string;
};

export const MAX_SESSION_MESSAGES = 50;

export function shouldCloseSession(
  lastMessageAt: Date,
  messageCount: number,
  timeoutMinutes: number,
  now: Date = new Date()
): boolean {
  if (messageCount >= MAX_SESSION_MESSAGES) return true;
  const idleMs = now.getTime() - lastMessageAt.getTime();
  return idleMs >= timeoutMinutes * 60_000;
}

export function formatSessionTranscript(messages: BufferedMessage[]): string {
  return messages
    .map((m) => {
      const who = m.direction === 'IN' ? 'Contact' : 'Équipe';
      return `[${who}] ${m.text}`;
    })
    .join('\n');
}
