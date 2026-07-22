export type StructuredLogPayload = {
  service: string;
  event: string;
  organizationId?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
  meta?: Record<string, unknown>;
};

export function structuredLog(payload: StructuredLogPayload): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: payload.success === false ? 'error' : 'info',
    ...payload,
  });
  if (payload.success === false) {
    console.error(line);
  } else {
    console.log(line);
  }
}

export async function withStructuredLog<T>(
  service: string,
  event: string,
  fn: () => Promise<T>,
  opts: { organizationId?: string; meta?: Record<string, unknown> } = {}
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    structuredLog({
      service,
      event,
      organizationId: opts.organizationId,
      durationMs: Date.now() - started,
      success: true,
      meta: opts.meta,
    });
    return result;
  } catch (err) {
    structuredLog({
      service,
      event,
      organizationId: opts.organizationId,
      durationMs: Date.now() - started,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      meta: opts.meta,
    });
    throw err;
  }
}
