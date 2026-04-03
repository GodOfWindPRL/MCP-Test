import {
  getTronLinkDelegatedPrivateKey,
  hasTronLinkWalletForApi,
  isTronLinkMcpMarkedAvailable,
  normalizePrivateKey,
} from './env.js';
import { sendTrxTransfer } from './sendTrx.js';

export interface SendFundsArgs {
  amount: number;
  privateKey?: string;
  /** Bắt buộc để gửi on-chain (TRX). */
  to: string;
}

export type SendFundsSource =
  | 'tronlink_mcp_wallet'
  | 'input_private_key'
  | 'error';

export interface SendFundsOutcome {
  ok: boolean;
  source: SendFundsSource;
  message?: string;
  result?: unknown;
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

  const mcpFlag = isTronLinkMcpMarkedAvailable();
  const walletReady = hasTronLinkWalletForApi();
  const inputPk = normalizePrivateKey(args.privateKey);

  if (mcpFlag && walletReady) {
    const pk = getTronLinkDelegatedPrivateKey()!;
    const out = await sendTrxTransfer({
      privateKeyHex: pk,
      amountTrx: args.amount,
      toAddress: to,
    });
    return {
      ok: true,
      source: 'tronlink_mcp_wallet',
      result: out,
    };
  }

  if (inputPk) {
    const out = await sendTrxTransfer({
      privateKeyHex: inputPk,
      amountTrx: args.amount,
      toAddress: to,
    });
    return {
      ok: true,
      source: 'input_private_key',
      result: out,
    };
  }

  const reasons: string[] = [];
  if (!mcpFlag) {
    reasons.push('TRONLINK_MCP_AVAILABLE is not set to true (agent chưa đánh dấu đã có TronLink MCP).');
  } else if (!walletReady) {
    reasons.push(
      'TronLink MCP được đánh dấu nhưng chưa có private key API (đặt TRONLINK_API_PRIVATE_KEY hoặc TL_MINIMAL_TEST_PRIVATE_KEY).',
    );
  }
  if (!inputPk) {
    reasons.push('Không có `privateKey` hợp lệ trong input (64 hex).');
  }

  return {
    ok: false,
    source: 'error',
    message: reasons.join(' '),
  };
}
