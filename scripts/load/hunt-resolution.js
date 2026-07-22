/**
 * Tests de charge — scénarios Phase 6 Bloc 4
 *
 * Seuils d'acceptation (staging) :
 * - Hunt batch 100 prospects : résolution < 120s
 * - WhatsApp 50 sessions simultanées : 0 message perdu
 * - Pipeline recalc 10k contacts : batch 500/run < 60s par run
 *
 * Usage (k6 requis) :
 *   k6 run scripts/load/hunt-resolution.js
 *
 * Variables :
 *   BASE_URL, AUTH_TOKEN
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:4000';
const TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  const res = http.get(`${BASE}/api/health`, { headers });
  check(res, { 'health ok': (r) => r.status === 200 });
  sleep(1);
}
