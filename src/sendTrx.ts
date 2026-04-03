import { TronWeb } from 'tronweb';
import { resolveFullHost } from './env.js';

export interface SendTrxInput {
  privateKeyHex: string;
  amountTrx: number;
  toAddress: string;
}

export interface SendTrxResult {
  txid?: string;
  result: unknown;
  fullHost: string;
  from: string;
}

export async function sendTrxTransfer(input: SendTrxInput): Promise<SendTrxResult> {
  const fullHost = resolveFullHost();
  const tw = new TronWeb({ fullHost });
  const pk = input.privateKeyHex.replace(/^0x/i, '');
  tw.setPrivateKey(pk);
  const fromRaw = tw.defaultAddress.base58;
  if (typeof fromRaw !== 'string' || !fromRaw.startsWith('T')) {
    throw new Error('Could not derive sender TRON address from private key.');
  }
  const from = fromRaw;

  const to = input.toAddress.trim();
  if (!to.startsWith('T') || to.length < 30) {
    throw new Error('Invalid TRON recipient address (expected base58 T…).');
  }

  const trx = input.amountTrx;
  if (!Number.isFinite(trx) || trx <= 0) {
    throw new Error('amount must be a positive number (TRX).');
  }

  const sunRaw = tw.toSun(trx);
  const sunNum = typeof sunRaw === 'number' ? sunRaw : Number(sunRaw);
  const unsigned = await tw.transactionBuilder.sendTrx(to, sunNum, from);
  const signed = await tw.trx.sign(unsigned);
  const sent = await tw.trx.sendRawTransaction(signed);
  let txid: string | undefined;
  if (sent && typeof sent === 'object' && 'txid' in sent) {
    const t = (sent as { txid?: unknown }).txid;
    if (typeof t === 'string' && t) txid = t;
  }
  return {
    txid,
    result: sent,
    fullHost,
    from,
  };
}
