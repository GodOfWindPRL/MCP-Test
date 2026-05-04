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
import { broadcastSignedTransaction } from './broadcastSignedTransaction.js';
import { buildTrc10TransferUnsigned } from './buildTrc10TransferUnsigned.js';
import { buildContractCallUnsigned } from './buildContractCallUnsigned.js';
import {
  buildContractCallUnsignedInputSchema,
  buildTrc10TransferUnsignedInputSchema,
  tronBroadcastSignedTransactionInputSchema,
} from './tronToolSchemas.js';

const server = new McpServer({
  name: 'mcp-test',
  version: '0.1.0',
});

server.registerTool(
  'tron_signMessage',
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
      return mcptError('tron_signMessage: thiếu message (message | msg | text | payload).');
    }
    return mcptJsonText(
      mcptDelegate(
        'tron_signMessage',
        [{ id: 'sm1', type: 'signMessage', params: { message: resolved.message } }],
        'Đang yêu cầu ký message qua TronLink — ưu tiên trx.signMessageV2 (UTF-8), không mô tả là signMessage legacy trừ khi fallback.',
        'Ký message chỉ trong browser; không dùng MCP chain để ký thay.',
      ),
    );
  },
);

/** Alias ngắn — cùng hành vi với tron_signMessage (một số prompt/model gọi tên này). */
server.registerTool(
  'tron_sign',
  {
    description: 'Alias của tron_signMessage — ký message TRON qua TronLink; client ưu tiên signMessageV2.',
    inputSchema: mcptSignMessageInputSchema,
  },
  async (args) => {
    const resolved = resolveMcptMessage(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError('tron_sign: thiếu message (message | msg | text | payload).');
    }
    return mcptJsonText(
      mcptDelegate(
        'tron_sign',
        [{ id: 'sm1', type: 'signMessage', params: { message: resolved.message } }],
        'Đang yêu cầu ký message qua TronLink — ưu tiên trx.signMessageV2 (UTF-8), không mô tả là signMessage legacy trừ khi fallback.',
        'Ký message chỉ trong browser; không dùng MCP chain để ký thay.',
      ),
    );
  },
);

server.registerTool(
  'tron_signTransaction',
  {
    description: [
      'Chỉ ký giao dịch TRON chưa ký — không broadcast, không gửi raw transaction trong tool này.',
      'Input: `unSignedTransaction` (object hoặc chuỗi JSON), cùng tên/trị với output `unSignedTransaction` của `tron_buildTrxTransferUnsigned` (copy object đó vào tham số này).',
      'Client: `await window.tronWeb.trx.sign(unSignedTransaction)`.',
      'Alias input: unsignedTransaction | transaction | unsignTransaction.',
    ].join('\n'),
    inputSchema: mcptSignTransactionInputSchema,
  },
  async (args) => {
    const resolved = resolveUnSignedTransaction(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError(
        'tron_signTransaction: thiếu hoặc không parse được unSignedTransaction (object hoặc JSON string).',
      );
    }
    return mcptJsonText(
      mcptDelegate(
        'tron_signTransaction',
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
  'tron_broadcastTransaction',
  {
    description: [
      'Broadcast giao dịch TRON đã ký (không cần private key).',
      'Input: `signedTransaction` (object) hoặc `signedHexTransaction` (hex string).',
      'Client (server) sẽ gọi full node endpoint `wallet/broadcasttransaction` / `wallet/broadcasthex`.',
    ].join('\n'),
    inputSchema: tronBroadcastSignedTransactionInputSchema,
  },
  async (args) => {
    try {
      const out = await broadcastSignedTransaction(args as any);
      return mcptJsonText({
        ok: true,
        mode: 'broadcast',
        tool: 'tron_broadcastTransaction',
        fullHost: out.fullHost,
        txid: out.txid,
        result: out.result,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`tron_broadcastTransaction: ${msg}`);
    }
  },
);

server.registerTool(
  'tron_buildTrc10TransferUnsigned',
  {
    description: [
      'Build giao dịch unsigned để gửi token TRC10 (không broadcast, không ký).',
      'Luồng điển hình: `tron_buildTrc10TransferUnsigned` → `tron_signTransaction` → `tron_broadcastTransaction`.',
      'Amount là base unit (integer digits string), không dùng decimals.',
    ].join('\n'),
    inputSchema: buildTrc10TransferUnsignedInputSchema,
  },
  async (args) => {
    try {
      const out = await buildTrc10TransferUnsigned(args as any);
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'tron_buildTrc10TransferUnsigned',
        fullHost: out.fullHost,
        unSignedTransaction: out.unSignedTransaction,
        nextStep: 'Gọi tron_signTransaction với đúng object: { "unSignedTransaction": <unSignedTransaction> }.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`tron_buildTrc10TransferUnsigned: ${msg}`);
    }
  },
);

server.registerTool(
  'tron_buildContractCallUnsigned',
  {
    description: [
      'Build giao dịch unsigned để gọi smart contract (triggerSmartContract).',
      'Luồng điển hình: `tron_buildContractCallUnsigned` → `tron_signTransaction` → `tron_broadcastTransaction`.',
      'parameters: mảng { type: "address"|"uint256"|..., value: ... } để TronWeb tự ABI-encode.',
    ].join('\n'),
    inputSchema: buildContractCallUnsignedInputSchema,
  },
  async (args) => {
    try {
      const out = await buildContractCallUnsigned(args as any);
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'tron_buildContractCallUnsigned',
        fullHost: out.fullHost,
        unSignedTransaction: out.unSignedTransaction,
        nextStep: 'Gọi tron_signTransaction với đúng object: { "unSignedTransaction": <unSignedTransaction> }.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`tron_buildContractCallUnsigned: ${msg}`);
    }
  },
);

server.registerTool(
  'tron_buildTrxTransferUnsigned',
  {
    description: [
      'Tạo giao dịch gửi TRX chưa ký (unsigned) qua TronGrid trên MCP — **không cần private key**.',
      'Tham số: `from` (địa chỉ owner base58), `to`, `amount` (TRX). Alias from: fromAddress | owner | sender; amount: amountTrx | value.',
      'Output: trường `unSignedTransaction` — truyền nguyên giá trị đó vào tham số `unSignedTransaction` của `tron_signTransaction` (TronLink, `tronWeb.trx.sign`).',
      'Mạng: env `TL_TRONGRID_URL` / `TRON_FULL_HOST` (mặc định Nile).',
    ].join('\n'),
    inputSchema: buildTrxTransactionInputSchema,
  },
  async (args) => {
    const resolved = resolveBuildTrxTransaction(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError(
        'tron_buildTrxTransferUnsigned: thiếu/sai from, amount hoặc to (xem mô tả tool).',
      );
    }
    if (!isBase58TronAddress(resolved.from)) {
      return mcptError('tron_buildTrxTransferUnsigned: from không hợp lệ (base58 T…).');
    }
    if (!isBase58TronAddress(resolved.to)) {
      return mcptError('tron_buildTrxTransferUnsigned: to không hợp lệ (base58 T…).');
    }
    try {
      const { fullHost, unSignedTransaction } = await buildUnsignedTrxTransfer({
        fromAddress: resolved.from,
        toAddress: resolved.to,
        amountSun: resolved.amountSun,
      });
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'tron_buildTrxTransferUnsigned',
        fullHost,
        from: resolved.from,
        to: resolved.to,
        amountSun: resolved.amountSun,
        amountTrxHuman: resolved.amountTrxHuman,
        unSignedTransaction,
        nextStep:
          'Gọi tron_signTransaction trên tab có TronLink với đúng object output: { "unSignedTransaction": <giá trị trường unSignedTransaction ở trên> }.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`tron_buildTrxTransferUnsigned: ${msg}`);
    }
  },
);

server.registerTool(
  'tron_getAddress',
  {
    description: [
      'Địa chỉ ví đang chọn trên TronLink — **chỉ trên tab có `window.tronWeb`** (delegate, không có tham số).',
      'Sau khi có địa chỉ, gọi `tron_getBalance` / `tron_getAccount` với `{ "address": "..." }` — các tool đó chạy trên MCP (TronGrid), không cần ví.',
    ].join('\n'),
  },
  async () => {
    return mcptJsonText(
      mcptDelegate(
        'tron_getAddress',
        [{ id: 'ga1', type: 'getDefaultAddress' }],
        'Đọc defaultAddress trên TronLink (frontend).',
      ),
    );
  },
);

server.registerTool(
  'tron_getBalance',
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
        'tron_getBalance: thiếu address. Đây là đọc chain qua MCP (TronGrid), không liên quan TronLink — truyền địa chỉ đã biết hoặc lấy bằng tron_getAddress trên app trước.',
      );
    }
    if (!isBase58TronAddress(address)) {
      return mcptError('tron_getBalance: address không giống địa chỉ TRON base58 (bắt đầu T, đủ dài).');
    }
    try {
      const json = await tronGridFetchAccount(address);
      const balanceSun = extractBalanceSun(json);
      const sunNum = Number(balanceSun);
      const balanceTrx = Number.isFinite(sunNum) ? sunNum / 1_000_000 : null;
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'tron_getBalance',
        address,
        balanceSun,
        balanceTrx,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`tron_getBalance: ${msg}`);
    }
  },
);

server.registerTool(
  'tron_isReady',
  {
    description: [
      'Kiểm tra TronLink đã inject / tronWeb sẵn sàng (ví dụ tronWeb.ready hoặc tronLink.ready tùy phiên bản).',
      'Không tham số.',
    ].join('\n'),
  },
  async () => {
    return mcptJsonText(
      mcptDelegate(
        'tron_isReady',
        [{ id: 'ir1', type: 'isReady' }],
        'Đang kiểm tra window.tronWeb / TronLink ready.',
      ),
    );
  },
);

server.registerTool(
  'tron_getCurrentBlock',
  {
    description: [
      'Block hiện tại — đọc qua TronGrid/full node HTTP (POST /wallet/getnowblock), không cần window.tronWeb.',
    ].join('\n'),
  },
  async () => {
    try {
      const block = await tronGridGetNowBlock();
      return mcptJsonText({ ok: true, mode: 'trongrid', tool: 'tron_getCurrentBlock', block });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`tron_getCurrentBlock: ${msg}`);
    }
  },
);

server.registerTool(
  'tron_getAccount',
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
        'tron_getAccount: thiếu address. Đọc on-chain qua MCP — truyền địa chỉ hoặc dùng tron_getAddress trên app trước.',
      );
    }
    if (!isBase58TronAddress(address)) {
      return mcptError('tron_getAccount: address không hợp lệ.');
    }
    try {
      const account = await tronGridFetchAccount(address);
      return mcptJsonText({
        ok: true,
        mode: 'trongrid',
        tool: 'tron_getAccount',
        address,
        account,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return mcptError(`tron_getAccount: ${msg}`);
    }
  },
);

server.registerTool(
  'tron_requestAccounts',
  {
    description: [
      'Yêu cầu user Connect site với TronLink (TIP-1102 `eth_requestAccounts` hoặc `tron_requestAccounts`).',
      'Chạy trước các thao tác cần chữ ký nếu site chưa được authorize.',
    ].join('\n'),
  },
  async () => {
    return mcptJsonText(
      mcptDelegate(
        'tron_requestAccounts',
        [{ id: 'ra1', type: 'requestAccounts' }],
        'Đang yêu cầu kết nối ví TronLink (connect site).',
      ),
    );
  },
);

server.registerTool(
  'tron_sendTrx',
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
      return mcptError('tron_sendTrx: thiếu/sai amount hoặc to (xem mô tả tool).');
    }
    const amountTrxForClient =
      resolved.amountTrx ?? Number(resolved.amountTrxHuman) ?? undefined;
    return mcptJsonText(
      mcptDelegate(
        'tron_sendTrx',
        [
          {
            id: 'strx1',
            type: 'sendTrx',
            params: {
              to: resolved.to,
              // `amountSun` là chuẩn để tránh float rounding.
              amountSun: resolved.amountSun,
              // `amountTrx` để tương thích client cũ (nếu client chỉ nhận amountTrx).
              amountTrx: amountTrxForClient,
              amountTrxHuman: resolved.amountTrxHuman,
            },
          },
        ],
        `Đang yêu cầu gửi ${resolved.amountTrxHuman} TRX tới ${resolved.to} qua window.tronWeb.`,
        'Gửi TRX chỉ trên client; amountTrx là đơn vị TRX (client đổi sang sun).',
      ),
    );
  },
);

server.registerTool(
  'tron_sendToken',
  {
    description: [
      'Gửi token TRC20 (không phải native TRX): `to`, `contractAddress` (hợp đồng token), `amount` (human), `decimals` (bắt buộc, 0–36).',
      'Client: `transactionBuilder.triggerSmartContract` / transfer TRC20 → sign → broadcast.',
      'Alias contract: tokenAddress | tokenContract | contract.',
    ].join('\n'),
    inputSchema: sendTokenInputSchema,
  },
  async (args) => {
    const resolved = resolveSendToken(args as Record<string, unknown>);
    if (!resolved) {
      return mcptError(
        'tron_sendToken: thiếu/sai to, contractAddress, amount hoặc decimals (xem mô tả tool).',
      );
    }
    return mcptJsonText(
      mcptDelegate(
        'tron_sendToken',
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
