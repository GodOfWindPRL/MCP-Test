import { TronWeb } from 'tronweb';
import { resolveFullHost } from './env.js';

export interface BuildTrxTransactionInput {
  fromAddress: string;
  toAddress: string;
  /** Amount in sun (integer digits string) to avoid float rounding */
  amountSun: string;
}

export interface BuildTrxTransactionResult {
  fullHost: string;
  unSignedTransaction: unknown;
}

/**
 * Tạo giao dịch gửi TRX chưa ký qua full node (TronGrid).
 * Không cần private key — `from` chỉ để set owner trong raw transaction.
 */
export async function buildUnsignedTrxTransfer(input: BuildTrxTransactionInput): Promise<BuildTrxTransactionResult> {
  const fullHost = resolveFullHost();
  const tw = new TronWeb({ fullHost });

  const from = input.fromAddress.trim();
  const to = input.toAddress.trim();
  if (!from.startsWith('T') || from.length < 30) {
    throw new Error('Invalid TRON sender address (from, base58 T…).');
  }
  if (!to.startsWith('T') || to.length < 30) {
    throw new Error('Invalid TRON recipient address (to, base58 T…).');
  }

  const sun = input.amountSun.trim();
  if (!/^\d+$/.test(sun)) {
    throw new Error('amountSun must be a positive integer string (sun).');
  }
  if (sun === '0') {
    throw new Error('amountSun must be > 0.');
  }

  // TronWeb runtime accepts amount as string (it will parseInt internally).
  // The TS type for sendTrx is stricter, so we cast to avoid float rounding via number.
  const built = await (tw.transactionBuilder as any).sendTrx(to, sun, from);
  const expirationMs = (built as { raw_data: { expiration: number } }).raw_data.expiration;
  const targetExpirationMs = Date.now() + 10 * 60 * 1000;
  const extensionSeconds = Math.ceil((targetExpirationMs - expirationMs) / 1000);
  const unSignedTransaction =
    extensionSeconds > 0
      ? await tw.transactionBuilder.extendExpiration(built, extensionSeconds)
      : built;
  return { fullHost, unSignedTransaction };
}
