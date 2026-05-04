import { TronWeb } from 'tronweb';
import { resolveFullHost } from './env.js';

export interface BroadcastSignedTransactionInput {
  signedTransaction?: unknown;
  signedHexTransaction?: string;
}

export interface BroadcastSignedTransactionResult {
  fullHost: string;
  txid?: string;
  result: unknown;
}

/**
 * Broadcast transaction đã được ký.
 * Không cần private key, chỉ cần signedTransaction (có signature) hoặc signedHexTransaction.
 */
export async function broadcastSignedTransaction(
  input: BroadcastSignedTransactionInput,
): Promise<BroadcastSignedTransactionResult> {
  const fullHost = resolveFullHost();
  const tw = new TronWeb({ fullHost });

  if (input.signedHexTransaction) {
    const signedHexTransaction = input.signedHexTransaction.trim();
    const res = await (tw.trx as any).broadcastHex(signedHexTransaction);
    const txid = (res && typeof res === 'object' && 'txid' in res ? (res as any).txid : undefined) as
      | string
      | undefined;
    return { fullHost, txid, result: res };
  }

  if (input.signedTransaction) {
    const signedTransaction = input.signedTransaction;
    const res = await (tw.trx as any).broadcast(signedTransaction);
    const txid = (res && typeof res === 'object' && 'txid' in res ? (res as any).txid : undefined) as
      | string
      | undefined;
    return { fullHost, txid, result: res };
  }

  throw new Error('Missing signedTransaction or signedHexTransaction');
}

