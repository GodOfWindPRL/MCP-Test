#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildUnsignedTrxTransfer } from './buildTrxTransaction.js';
import {
  buildTrxTransactionInputSchema,
  mcptGetAccountInputSchema,
  mcptGetBalanceInputSchema,
  mcptSignMessageInputSchema,
  mcptSignTransactionInputSchema,
  resolveBuildTrxTransaction,
  resolveMcptAddress,
  resolveMcptMessage,
  resolveSendToken,
  resolveSendTrx,
  resolveUnSignedTransaction,
  sendTokenInputSchema,
  sendTrxInputSchema,
} from './mcptSchemas.js';
import { mcptDelegate, mcptError, mcptJsonText } from './mcptResponse.js';
import {
  extractBalanceSun,
  isBase58TronAddress,
  tronGridFetchAccount,
  tronGridGetNowBlock,
} from './tronGridRead.js';

const server = new McpServer({
  name: 'mcp-test',
  version: '0.1.0',
});

server.registerTool(
  'mcpt_signMessage',
  {
    description: [
      'Ký message TRON qua TronLink: input `message` (alias: msg | text | payload).',
      'Client (app) ưu tiên `tronWeb.trx.signMessageV2(message)` với chuỗi UTF-8; chỉ fallback `signMessage` (legacy, thường hex) nếu không có V2.',
      'MCP không có window.tronWeb; trả `clientWalletActions` (type signMessage) để frontend gọi đúng API trên ví.',
    ].join('\n'),
    inputSchema: mcptSignMessageInputSchema,
  },
  async (args) => {
    const resolved = resolveMcptMessage(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError('mcpt_signMessage: thiếu message (message | msg | text | payload).');
    }
    return mcptJsonText(
      mcptDelegate(
        'mcpt_signMessage',
        [{ id: 'sm1', type: 'signMessage', params: { message: resolved.message } }],
        'Đang yêu cầu ký message qua TronLink — ưu tiên trx.signMessageV2 (UTF-8), không mô tả là signMessage legacy trừ khi fallback.',
        'Ký message chỉ trong browser; không dùng MCP chain để ký thay.',
      ),
    );
  },
);

/** Alias ngắn — cùng hành vi với mcpt_signMessage (một số prompt/model gọi tên này). */
server.registerTool(
  'mcpt_sign',
  {
    description: 'Alias của mcpt_signMessage — ký message TRON qua TronLink; client ưu tiên signMessageV2.',
    inputSchema: mcptSignMessageInputSchema,
  },
  async (args) => {
    const resolved = resolveMcptMessage(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError('mcpt_sign: thiếu message (message | msg | text | payload).');
    }
    return mcptJsonText(
      mcptDelegate(
        'mcpt_sign',
        [{ id: 'sm1', type: 'signMessage', params: { message: resolved.message } }],
        'Đang yêu cầu ký message qua TronLink — ưu tiên trx.signMessageV2 (UTF-8), không mô tả là signMessage legacy trừ khi fallback.',
        'Ký message chỉ trong browser; không dùng MCP chain để ký thay.',
      ),
    );
  },
);

server.registerTool(
  'mcpt_signTransaction',
  {
    description: [
      'Chỉ ký giao dịch TRON chưa ký — không broadcast, không gửi raw transaction trong tool này.',
      'Input: `unSignedTransaction` (object hoặc chuỗi JSON), cùng tên/trị với output `unSignedTransaction` của `mcpt_buildTrxTransaction` (copy object đó vào tham số này).',
      'Client: `await window.tronWeb.trx.sign(unSignedTransaction)`.',
      'Alias input: unsignedTransaction | transaction | unsignTransaction.',
    ].join('\n'),
    inputSchema: mcptSignTransactionInputSchema,
  },
  async (args) => {
    const resolved = resolveUnSignedTransaction(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError(
        'mcpt_signTransaction: thiếu hoặc không parse được unSignedTransaction (object hoặc JSON string).',
      );
    }
    return mcptJsonText(
      mcptDelegate(
        'mcpt_signTransaction',
        [
          {
            id: 'st1',
            type: 'signTransaction',
            params: { transaction: resolved.transaction },
          },
        ],
        'Đang yêu cầu ký giao dịch qua window.tronWeb.trx.sign(...).',
        'Chỉ bước ký trên ví; không broadcast trong tool này.',
      ),
    );
  },
);

server.registerTool(
  'mcpt_buildTrxTransaction',
  {
    description: [
      'Tạo giao dịch gửi TRX chưa ký (unsigned) qua TronGrid trên MCP — **không cần private key**.',
      'Tham số: `from` (địa chỉ owner base58), `to`, `amount` (TRX). Alias from: fromAddress | owner | sender; amount: amountTrx | value.',
      'Output: trường `unSignedTransaction` — truyền nguyên giá trị đó vào tham số `unSignedTransaction` của `mcpt_signTransaction` (TronLink, `tronWeb.trx.sign`).',
      'Mạng: env `TL_TRONGRID_URL` / `TRON_FULL_HOST` (mặc định Nile).',
    ].join('\n'),
    inputSchema: buildTrxTransactionInputSchema,
  },
  async (args) => {
    const resolved = resolveBuildTrxTransaction(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError(
        'mcpt_buildTrxTransaction: thiếu/sai from, amount hoặc to (xem mô tả tool).',
      );
    }
    if (!isBase58TronAddress(resolved.from)) {
      return mcptError('mcpt_buildTrxTransaction: from không hợp lệ (base58 T…).');
    }
    if (!isBase58TronAddress(resolved.to)) {
      return mcptError('mcpt_buildTrxTransaction: to không hợp lệ (base58 T…).');
    }
    try {
      const { fullHost, unSignedTransaction } = await buildUnsignedTrxTransfer({
        fromAddress: resolved.from,
        toAddress: resolved.to,
        amountTrx: resolved.amountTrx,
      });
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'mcpt_buildTrxTransaction',
        fullHost,
        from: resolved.from,
        to: resolved.to,
        amountTrx: resolved.amountTrx,
        unSignedTransaction,
        nextStep:
          'Gọi mcpt_signTransaction trên tab có TronLink với đúng object output: { "unSignedTransaction": <giá trị trường unSignedTransaction ở trên> }.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`mcpt_buildTrxTransaction: ${msg}`);
    }
  },
);

server.registerTool(
  'mcpt_getAddress',
  {
    description: [
      'Địa chỉ ví đang chọn trên TronLink — **chỉ trên tab có `window.tronWeb`** (delegate, không có tham số).',
      'Sau khi có địa chỉ, gọi `mcpt_getBalance` / `mcpt_getAccount` với `{ "address": "..." }` — các tool đó chạy trên MCP (TronGrid), không cần ví.',
    ].join('\n'),
  },
  async () => {
    return mcptJsonText(
      mcptDelegate(
        'mcpt_getAddress',
        [{ id: 'ga1', type: 'getDefaultAddress' }],
        'Đọc defaultAddress trên TronLink (frontend).',
      ),
    );
  },
);

server.registerTool(
  'mcpt_getBalance',
  {
    description: [
      'Số dư TRX on-chain qua TronGrid trên MCP — **bắt buộc `address`** (base58).',
      'Không dùng TronLink; không “chờ client” nếu đã truyền đúng địa chỉ. Mạng: env `TL_TRONGRID_URL` / `TRON_FULL_HOST` (mặc định Nile).',
    ].join('\n'),
    inputSchema: mcptGetBalanceInputSchema,
  },
  async (args) => {
    const address = resolveMcptAddress(args as Record<string, unknown>);
    if (!address) {
      return mcptError(
        'mcpt_getBalance: thiếu address. Đây là đọc chain qua MCP (TronGrid), không liên quan TronLink — truyền địa chỉ đã biết hoặc lấy bằng mcpt_getAddress trên app trước.',
      );
    }
    if (!isBase58TronAddress(address)) {
      return mcptError('mcpt_getBalance: address không giống địa chỉ TRON base58 (bắt đầu T, đủ dài).');
    }
    try {
      const json = await tronGridFetchAccount(address);
      const balanceSun = extractBalanceSun(json);
      const sunNum = Number(balanceSun);
      const balanceTrx = Number.isFinite(sunNum) ? sunNum / 1_000_000 : null;
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'mcpt_getBalance',
        address,
        balanceSun,
        balanceTrx,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`mcpt_getBalance: ${msg}`);
    }
  },
);

server.registerTool(
  'mcpt_isReady',
  {
    description: [
      'Kiểm tra TronLink đã inject / tronWeb sẵn sàng (ví dụ tronWeb.ready hoặc tronLink.ready tùy phiên bản).',
      'Không tham số.',
    ].join('\n'),
  },
  async () => {
    return mcptJsonText(
      mcptDelegate(
        'mcpt_isReady',
        [{ id: 'ir1', type: 'isReady' }],
        'Đang kiểm tra window.tronWeb / TronLink ready.',
      ),
    );
  },
);

server.registerTool(
  'mcpt_getCurrentBlock',
  {
    description: [
      'Block hiện tại — đọc qua TronGrid/full node HTTP (POST /wallet/getnowblock), không cần window.tronWeb.',
    ].join('\n'),
  },
  async () => {
    try {
      const block = await tronGridGetNowBlock();
      return mcptJsonText({ ok: true, mode: 'trongrid', tool: 'mcpt_getCurrentBlock', block });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`mcpt_getCurrentBlock: ${msg}`);
    }
  },
);

server.registerTool(
  'mcpt_getAccount',
  {
    description: [
      'Account TRON qua TronGrid trên MCP — **bắt buộc `address`** (base58).',
      'Không dùng TronLink. Mạng theo env TronGrid (mặc định Nile).',
    ].join('\n'),
    inputSchema: mcptGetAccountInputSchema,
  },
  async (args) => {
    const address = resolveMcptAddress(args as Record<string, unknown>);
    if (!address) {
      return mcptError(
        'mcpt_getAccount: thiếu address. Đọc on-chain qua MCP — truyền địa chỉ hoặc dùng mcpt_getAddress trên app trước.',
      );
    }
    if (!isBase58TronAddress(address)) {
      return mcptError('mcpt_getAccount: address không hợp lệ.');
    }
    try {
      const account = await tronGridFetchAccount(address);
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'mcpt_getAccount',
        address,
        account,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`mcpt_getAccount: ${msg}`);
    }
  },
);

server.registerTool(
  'mcpt_requestAccounts',
  {
    description: [
      'Yêu cầu user Connect site với TronLink (TIP-1102 `eth_requestAccounts` hoặc `tron_requestAccounts`).',
      'Chạy trước các thao tác cần chữ ký nếu site chưa được authorize.',
    ].join('\n'),
  },
  async () => {
    return mcptJsonText(
      mcptDelegate(
        'mcpt_requestAccounts',
        [{ id: 'ra1', type: 'requestAccounts' }],
        'Đang yêu cầu kết nối ví TronLink (connect site).',
      ),
    );
  },
);

server.registerTool(
  'send_trx',
  {
    description: [
      'Gửi TRX on-chain qua TronLink: `amount` (TRX), `to` (base58).',
      'Client dùng `transactionBuilder.sendTrx` → `trx.sign` → `trx.sendRawTransaction` với `window.tronWeb`.',
      'Alias: amount ↔ amountTrx/value; to ↔ toAddress/recipient.',
    ].join('\n'),
    inputSchema: sendTrxInputSchema,
  },
  async (args) => {
    const resolved = resolveSendTrx(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError('send_trx: thiếu/sai amount hoặc to (xem mô tả tool).');
    }
    return mcptJsonText(
      mcptDelegate(
        'send_trx',
        [
          {
            id: 'strx1',
            type: 'sendTrx',
            params: { to: resolved.to, amountTrx: resolved.amountTrx },
          },
        ],
        `Đang yêu cầu gửi ${resolved.amountTrx} TRX tới ${resolved.to} qua window.tronWeb.`,
        'Gửi TRX chỉ trên client; amountTrx là đơn vị TRX (client đổi sang sun).',
      ),
    );
  },
);

server.registerTool(
  'send_token',
  {
    description: [
      'Gửi token TRC20 (không phải native TRX): `to`, `contractAddress` (hợp đồng token), `amount` (human), `decimals` (tuỳ chọn, mặc định 6).',
      'Client: `transactionBuilder.triggerSmartContract` / transfer TRC20 → sign → broadcast.',
      'Alias contract: tokenAddress | tokenContract | contract.',
    ].join('\n'),
    inputSchema: sendTokenInputSchema,
  },
  async (args) => {
    const resolved = resolveSendToken(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError(
        'send_token: thiếu/sai to, contractAddress, amount hoặc decimals (xem mô tả tool).',
      );
    }
    return mcptJsonText(
      mcptDelegate(
        'send_token',
        [
          {
            id: 'stk1',
            type: 'sendToken',
            params: {
              to: resolved.to,
              contractAddress: resolved.contractAddress,
              amount: resolved.amount,
              decimals: resolved.decimals,
            },
          },
        ],
        `Đang yêu cầu gửi token TRC20 (${resolved.contractAddress}) tới ${resolved.to} qua window.tronWeb.`,
      ),
    );
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
