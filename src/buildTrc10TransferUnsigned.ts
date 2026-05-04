import { TronWeb } from 'tronweb';
import { resolveFullHost } from './env.js';
import { isBase58TronAddress } from './tronGridRead.js';

export interface BuildTrc10TransferUnsignedInput {
  fromAddress: string; // issuer
  toAddress: string;
  tokenId: string; // TRC10 token id
  amount: string; // base unit integer (no decimals)
}

export interface BuildTrc10TransferUnsignedResult {
  fullHost: string;
  unSignedTransaction: unknown;
}

export async function buildTrc10TransferUnsigned(
  input: BuildTrc10TransferUnsignedInput,
): Promise<BuildTrc10TransferUnsignedResult> {
  const fullHost = resolveFullHost();
  const tw = new TronWeb({ fullHost });

  const from = input.fromAddress.trim();
  const to = input.toAddress.trim();
  if (!isBase58TronAddress(from)) throw new Error('Invalid TRON sender (fromAddress) base58 address.');
  if (!isBase58TronAddress(to)) throw new Error('Invalid TRON recipient (toAddress) base58 address.');

  const tokenId = input.tokenId.trim();
  if (!tokenId) throw new Error('tokenId is required.');

  const amount = input.amount.trim();
  if (!/^\d+$/.test(amount)) throw new Error('amount must be a positive integer string (base unit).');
  if (amount === '0') throw new Error('amount must be > 0.');

  // TronWeb TRC10 transfer uses transactionBuilder.sendToken(...)
  // TS type is stricter (expects number), so we cast to any to safely pass integer string.
  const tx = await (tw.transactionBuilder as any).sendToken(to, amount, tokenId, from);
  return { fullHost, unSignedTransaction: tx };
}

