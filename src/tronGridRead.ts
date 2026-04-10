/**
 * Đọc on-chain qua TronGrid / full node HTTP — không cần window.tronWeb.
 * Dùng env: TL_TRONGRID_URL | TRON_FULL_HOST | … (xem env.ts).
 */
import { resolveFullHost } from './env.js';

function baseUrl(): string {
  return resolveFullHost().replace(/\/$/, '');
}

/** GET /v1/accounts/:address */
export async function tronGridFetchAccount(address: string): Promise<unknown> {
  const url = `${baseUrl()}/v1/accounts/${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`TronGrid GET /v1/accounts: HTTP ${res.status}`);
  }
  return res.json();
}

export function extractBalanceSun(accountJson: unknown): string {
  const j = accountJson as { data?: Array<{ balance?: number | string }> };
  const row = j?.data?.[0];
  if (!row) return '0';
  const b = row.balance;
  if (b === undefined || b === null) return '0';
  return String(b);
}

/** POST /wallet/getnowblock */
export async function tronGridGetNowBlock(): Promise<unknown> {
  const url = `${baseUrl()}/wallet/getnowblock`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    throw new Error(`TronGrid POST /wallet/getnowblock: HTTP ${res.status}`);
  }
  return res.json();
}

export function isBase58TronAddress(s: string): boolean {
  return typeof s === 'string' && s.startsWith('T') && s.length >= 30;
}
