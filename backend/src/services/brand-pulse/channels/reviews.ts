/** Phase 2 — connecteur avis clients (Google Business, etc.). */
export type ReviewsChannelStatus = {
  connected: boolean;
  comingSoon: true;
  score: number | null;
  message: string;
};

export async function getReviewsChannelStatus(): Promise<ReviewsChannelStatus> {
  return {
    connected: false,
    comingSoon: true,
    score: null,
    message: 'Connecteur avis clients disponible en Phase 2.',
  };
}
