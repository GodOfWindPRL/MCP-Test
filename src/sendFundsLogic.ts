import { normalizePrivateKey } from './env.js';
import { sendTrxTransfer } from './sendTrx.js';

export interface SendFundsArgs {
  amount: number;
  privateKey?: string;
  /** Bắt buộc để gửi on-chain (TRX). */
  to: string;
}

/** `no_private_key` = không broadcast vì không có key trong input (optional). */
export type SendFundsSource = 'input_private_key' | 'no_private_key' | 'error';

export interface SendFundsOutcome {
  ok: boolean;
  source: SendFundsSource;
  message?: string;
  result?: unknown;
  /** Chỉ khi broadcast on-chain từ mcp-test; false = chuyển bước TronLink. */
  broadcast?: boolean;
}

export async function runSendFunds(args: SendFundsArgs): Promise<SendFundsOutcome> {
  const to = typeof args.to === 'string' ? args.to.trim() : '';
  if (!to) {
    return {
      ok: false,
      source: 'error',
      message:
        'Missing recipient `to` (TRON base58 address). Required to broadcast TRX.',
    };
  }

  const inputPk = normalizePrivateKey(args.privateKey);
  if (inputPk) {
    const out = await sendTrxTransfer({
      privateKeyHex: inputPk,
      amountTrx: args.amount,
      toAddress: to,
    });
    return {
      ok: true,
      source: 'input_private_key',
      broadcast: true,
      result: out,
    };
  }

  return {
    ok: true,
    source: 'no_private_key',
    broadcast: false,
    message:
      'Chưa có privateKey trong mcp-test; nếu có TronLink, agent có thể dùng tool TronLink để gửi (cùng amount/to).',
  };
}
