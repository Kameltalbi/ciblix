import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getAllowedCorsOrigins } from './corsOrigins.js';

describe('getAllowedCorsOrigins', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it('autorise FRONTEND_URL et sa variante www', () => {
    process.env.FRONTEND_URL = 'https://ciblix.com';
    const origins = getAllowedCorsOrigins();
    expect(origins).toContain('https://ciblix.com');
    expect(origins).toContain('https://www.ciblix.com');
  });

  it('autorise CORS_ORIGINS supplémentaires', () => {
    process.env.FRONTEND_URL = 'https://ciblix.com';
    process.env.CORS_ORIGINS = 'https://staging.ciblix.com';
    const origins = getAllowedCorsOrigins();
    expect(origins).toContain('https://staging.ciblix.com');
    expect(origins).toContain('https://www.staging.ciblix.com');
  });
});
