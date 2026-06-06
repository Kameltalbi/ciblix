/** Phase 2 — connecteur mentions réseaux sociaux (stub). */
export type SocialChannelStatus = {
  connected: boolean;
  comingSoon: true;
  score: number | null;
  message: string;
};

export async function getSocialChannelStatus(): Promise<SocialChannelStatus> {
  return {
    connected: false,
    comingSoon: true,
    score: null,
    message: 'Connecteur réseaux sociaux disponible en Phase 2.',
  };
}
