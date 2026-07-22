/**
 * Stockage objet pour transcriptions brutes (S3 ou stub local).
 * Phase 1 : no-op delete si S3 non configuré.
 */

export async function deleteRawContent(ref: string): Promise<void> {
  const bucket = process.env.AGENT_EVENT_S3_BUCKET;
  if (!bucket) {
    console.info('[agent-memory/s3] delete skipped (no bucket):', ref);
    return;
  }
  // V2 : brancher AWS SDK @aws-sdk/client-s3 DeleteObject
  console.info('[agent-memory/s3] delete (stub):', bucket, ref);
}
