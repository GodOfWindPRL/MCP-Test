/** CoinGecko public API (không cần key cho mức đơn giản). */

export interface TrxPriceResult {
  trxUsd: number;
  source: string;
  raw?: unknown;
}

export async function fetchTrxUsdPrice(): Promise<TrxPriceResult> {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd';
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko HTTP ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as { tron?: { usd?: number } };
  const usd = data?.tron?.usd;
  if (typeof usd !== 'number' || !Number.isFinite(usd)) {
    throw new Error('Unexpected CoinGecko response shape');
  }
  return { trxUsd: usd, source: url, raw: data };
}
